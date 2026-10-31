import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { Appointment, Checkin, Member, ResourceLock, Schedule, Trainer, User } from "../models/index.js";
import { httpError } from "../utils/http.js";
import { ACTIVE_APPT, CANCEL_BEFORE_HOURS, CLOSE_HOUR, OPEN_HOUR, SLOT_MINUTES } from "../utils/config.js";
import { vnDayKey, vnMinutes } from "../utils/time.js";
import { pickSubscription } from "./members.js";

const TX_OPTS = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } };

async function runTx(fn) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session), TX_OPTS);
  } finally {
    await session.endSession();
  }
}

// Khóa tài nguyên: hai giao dịch cùng chạm một khóa sẽ xung đột ghi -> một bên tự retry và thấy trạng thái mới (BR.01/BR.03)
async function lock(key, session) {
  await ResourceLock.findOneAndUpdate({ _id: key }, { $inc: { revision: 1 } }, { upsert: true, session });
}

// Tạo sẵn tài liệu khóa ngoài giao dịch để tránh va chạm khi hai giao dịch cùng upsert lần đầu
async function ensureLock(key) {
  await ResourceLock.updateOne({ _id: key }, { $setOnInsert: { revision: 0 } }, { upsert: true });
}

// ---------------------------------------------------------------- Đặt lịch (F.4.2)
export async function createBooking({ userId, scheduleId, subscriptionId, requestId, note }) {
  const member = await Member.findOne({ userId });
  if (!member) throw httpError(403, "Tài khoản chưa có hồ sơ hội viên");
  requestId = requestId || randomUUID();

  const dup = async () => {
    const ex = await Appointment.findOne({ requestId });
    if (!ex) return null;
    if (!ex.memberId.equals(member._id)) throw httpError(409, "requestId đã được sử dụng");
    return { appointment: ex, duplicate: true }; // gửi lặp -> trả booking cũ
  };
  const early = await dup();
  if (early) return early;

  const pre = await Schedule.findById(scheduleId).select("startAt trainerId");
  if (pre) {
    const day = vnDayKey(pre.startAt);
    await Promise.all([ensureLock(`member:${member._id}:${day}`), ensureLock(`trainer:${pre.trainerId}:${day}`)]);
  }

  let result;
  try {
    await runTx(async (session) => {
      result = null;
      const now = new Date();

      const sch = await Schedule.findById(scheduleId).session(session);
      if (!sch) throw httpError(404, "Không tìm thấy slot");
      if (!sch.isOpen) throw httpError(409, "Slot đã ngừng nhận lịch", { code: "SLOT_CLOSED" });
      if (sch.startAt <= now) throw httpError(422, "Chỉ đặt được slot ở tương lai", { code: "SLOT_PAST" });
      const m = vnMinutes(sch.startAt);
      if (m < OPEN_HOUR * 60 || m + SLOT_MINUTES > CLOSE_HOUR * 60) throw httpError(422, "Slot ngoài giờ mở cửa");
      if (sch.bookedSlots >= sch.maxSlots) throw httpError(409, "Slot đã được đặt", { code: "SLOT_TAKEN" });

      const trainer = await Trainer.findById(sch.trainerId).session(session);
      if (!trainer || !trainer.isActive) throw httpError(422, "HLV đã ngừng hoạt động");

      const day = vnDayKey(sch.startAt);
      await lock(`member:${member._id}:${day}`, session);
      await lock(`trainer:${trainer._id}:${day}`, session);

      const user = await User.findById(userId).session(session);
      if (!user?.isActive) throw httpError(403, "Tài khoản đã bị khóa");

      const mem = await Member.findById(member._id).session(session);
      const sub = pickSubscription(mem, trainer, sch.startAt, subscriptionId);
      if (!sub)
        throw httpError(422, "Gói đã hết hạn, hết buổi PT, hoặc HLV không hỗ trợ gói của bạn", { code: "NO_ENTITLEMENT" });

      const clash = await Appointment.exists({
        $or: [{ memberId: mem._id }, { trainerId: trainer._id }],
        status: { $in: ACTIVE_APPT },
        startAt: { $lt: sch.endAt },
        endAt: { $gt: sch.startAt },
      }).session(session);
      if (clash) throw httpError(409, "Bạn (hoặc HLV) đã có lịch trùng giờ này", { code: "OVERLAP" });

      // Giữ slot có điều kiện: chỉ thành công khi bookedSlots đang là 0
      const hold = await Schedule.updateOne({ _id: sch._id, bookedSlots: 0 }, { $set: { bookedSlots: 1 } }, { session });
      if (hold.modifiedCount !== 1) throw httpError(409, "Slot đã được đặt", { code: "SLOT_TAKEN" });

      // Tăng usedPt có điều kiện (so với giá trị vừa đọc trong cùng giao dịch)
      const use = await Member.updateOne(
        { _id: mem._id },
        { $inc: { "subscriptions.$[s].usedPt": 1 } },
        { session, arrayFilters: [{ "s._id": sub._id, "s.usedPt": sub.usedPt }] }
      );
      if (use.modifiedCount !== 1) throw httpError(409, "Quyền lợi gói vừa thay đổi, vui lòng thử lại");

      const [appt] = await Appointment.create(
        [
          {
            memberId: mem._id,
            trainerId: trainer._id,
            scheduleId: sch._id,
            subscriptionId: sub._id,
            startAt: sch.startAt,
            endAt: sch.endAt,
            status: "Pending", // chờ HLV duyệt; slot và buổi PT được giữ ngay từ lúc gửi yêu cầu
            requestId,
            note,
            createdBy: userId,
          },
        ],
        { session }
      );
      result = { appointment: appt, duplicate: false };
    });
  } catch (e) {
    if (e?.code === 11000 && e.keyPattern?.requestId) {
      const again = await dup();
      if (again) return again;
    }
    throw e;
  }
  return result;
}

// ---------------------------------------------------------------- Hủy lịch (F.4.3, BR.04)
export async function cancelBooking({ user, appointmentId, reason, refund }) {
  const member = user.role === "member" ? await Member.findOne({ userId: user._id }) : null;
  let result;
  await runTx(async (session) => {
    result = null;
    const now = new Date();
    const a = await Appointment.findById(appointmentId).session(session);
    if (!a) throw httpError(404, "Không tìm thấy lịch hẹn");
    if (user.role === "member" && !(member && a.memberId.equals(member._id))) throw httpError(403, "Bạn không có quyền với lịch hẹn này");
    if (!["member", "admin"].includes(user.role)) throw httpError(403, "Bạn không có quyền hủy lịch");

    // Hủy lặp -> trả trạng thái hiện tại, không hoàn buổi lần hai
    if (a.status === "Cancelled") {
      result = { appointment: a, duplicate: true };
      return;
    }
    if (!["Pending", "Confirmed"].includes(a.status)) throw httpError(409, `Không thể hủy lịch ở trạng thái ${a.status}`);

    const hoursLeft = (a.startAt - now) / 3600000;
    // Yêu cầu chưa được HLV duyệt thì hủy lúc nào cũng được và luôn hoàn buổi
    const onTime = a.status === "Pending" || hoursLeft >= CANCEL_BEFORE_HOURS;
    if (user.role === "member" && !onTime)
      throw httpError(422, `Chỉ được hủy trước giờ tập ít nhất ${CANCEL_BEFORE_HOURS} giờ. Vui lòng liên hệ quản trị viên.`, { code: "TOO_LATE" });
    if (user.role === "admin" && !onTime && !reason) throw httpError(422, "Hủy muộn bắt buộc phải ghi lý do");

    // Hội viên hủy đúng hạn luôn hoàn buổi; Admin hủy muộn chỉ hoàn khi chọn refund=true (ngoại lệ)
    const doRefund = user.role === "member" ? true : onTime || refund === true;

    const upd = await Appointment.updateOne(
      { _id: a._id, status: a.status },
      { $set: { status: "Cancelled", cancelledAt: now, cancelReason: reason, cancelledBy: user._id, refunded: doRefund } },
      { session }
    );
    if (upd.modifiedCount !== 1) throw httpError(409, "Lịch hẹn vừa thay đổi trạng thái, vui lòng tải lại");

    await Schedule.updateOne({ _id: a.scheduleId, bookedSlots: 1 }, { $set: { bookedSlots: 0 } }, { session });
    if (doRefund) {
      await Member.updateOne(
        { _id: a.memberId },
        { $inc: { "subscriptions.$[s].usedPt": -1 } },
        { session, arrayFilters: [{ "s._id": a.subscriptionId, "s.usedPt": { $gt: 0 } }] }
      );
    }
    const fresh = await Appointment.findById(a._id).session(session);
    result = { appointment: fresh, duplicate: false, refunded: doRefund };
  });
  return result;
}

// ---------------------------------------------------------------- HLV duyệt / từ chối yêu cầu đặt lịch
export async function decideBooking({ user, appointmentId, action, reason }) {
  const trainer = user.role === "trainer" ? await Trainer.findOne({ userId: user._id }) : null;
  if (user.role === "trainer" && !trainer) throw httpError(403, "Tài khoản chưa gắn với hồ sơ HLV");
  let result;
  await runTx(async (session) => {
    result = null;
    const a = await Appointment.findById(appointmentId).session(session);
    if (!a) throw httpError(404, "Không tìm thấy lịch hẹn");
    if (user.role === "trainer" && !a.trainerId.equals(trainer._id)) throw httpError(403, "Đây không phải lịch của bạn");
    const target = action === "confirm" ? "Confirmed" : "Rejected";
    if (a.status === target) {
      result = { appointment: a, duplicate: true }; // bấm lặp -> không xử lý lần hai
      return;
    }
    if (a.status !== "Pending") throw httpError(409, `Yêu cầu đã ở trạng thái ${a.status}, không thể xử lý nữa`, { code: "BAD_STATUS" });

    if (action === "confirm") {
      if (a.startAt <= new Date()) throw httpError(422, "Giờ tập đã qua, không thể xác nhận. Hãy từ chối yêu cầu này.", { code: "SLOT_PAST" });
      const upd = await Appointment.updateOne({ _id: a._id, status: "Pending" }, { $set: { status: "Confirmed" } }, { session });
      if (upd.modifiedCount !== 1) throw httpError(409, "Yêu cầu vừa thay đổi, vui lòng tải lại");
    } else {
      const upd = await Appointment.updateOne(
        { _id: a._id, status: "Pending" },
        { $set: { status: "Rejected", cancelledAt: new Date(), cancelReason: reason, cancelledBy: user._id, refunded: true } },
        { session }
      );
      if (upd.modifiedCount !== 1) throw httpError(409, "Yêu cầu vừa thay đổi, vui lòng tải lại");
      await Schedule.updateOne({ _id: a.scheduleId, bookedSlots: 1 }, { $set: { bookedSlots: 0 } }, { session });
      await Member.updateOne(
        { _id: a.memberId },
        { $inc: { "subscriptions.$[s].usedPt": -1 } },
        { session, arrayFilters: [{ "s._id": a.subscriptionId, "s.usedPt": { $gt: 0 } }] }
      );
    }
    result = { appointment: await Appointment.findById(a._id).session(session), duplicate: false };
  });
  return result;
}

// ---------------------------------------------------------------- Check-in (F.5.3, BR.05)
export async function checkIn({ userId, appointmentId }) {
  const existing = async () => {
    const c = await Checkin.findOne({ appointmentId });
    return c ? { checkin: c, duplicate: true } : null;
  };
  let result;
  try {
    await runTx(async (session) => {
      result = null;
      const now = new Date();
      const a = await Appointment.findById(appointmentId).session(session);
      if (!a) throw httpError(404, "Không tìm thấy lịch hẹn", { code: "NOT_FOUND" });

      if (a.status === "CheckedIn" || a.status === "Completed") {
        const c = await Checkin.findOne({ appointmentId: a._id }).session(session);
        result = { checkin: c, duplicate: true };
        return;
      }
      if (a.status !== "Confirmed") throw httpError(409, `Không thể check-in lịch ở trạng thái ${a.status}`, { code: "BAD_STATUS" });
      if (vnDayKey(a.startAt) !== vnDayKey(now)) throw httpError(422, "Chỉ check-in được lịch của ngày hôm nay", { code: "NOT_TODAY" });

      const mem = await Member.findById(a.memberId).session(session);
      const user = await User.findById(mem.userId).session(session);
      if (!user?.isActive) throw httpError(403, "Tài khoản hội viên đã bị khóa", { code: "LOCKED" });
      const sub = mem.subscriptions.id(a.subscriptionId);
      if (!sub || sub.status !== "Active" || sub.startDate > now || sub.endDate < now)
        throw httpError(422, "Gói tập đã hết hạn hoặc không còn hiệu lực", { code: "EXPIRED" });
      // Không kiểm tra remainingPt > 0 lần nữa: buổi đã được giữ khi đặt lịch (BR.05)

      const [c] = await Checkin.create(
        [{ appointmentId: a._id, memberId: a.memberId, trainerId: a.trainerId, checkInTime: now, status: "CheckedIn", checkedInBy: userId }],
        { session }
      );
      const upd = await Appointment.updateOne({ _id: a._id, status: "Confirmed" }, { $set: { status: "CheckedIn" } }, { session });
      if (upd.modifiedCount !== 1) throw httpError(409, "Lịch hẹn vừa thay đổi, vui lòng thử lại");
      result = { checkin: c, duplicate: false };
    });
  } catch (e) {
    if (e?.code === 11000) {
      const ex = await existing();
      if (ex) return ex; // gửi lặp / hai thiết bị đồng thời -> trả bản ghi gốc
    }
    throw e;
  }
  return result;
}
