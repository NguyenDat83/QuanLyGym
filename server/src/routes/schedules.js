import { Router } from "express";
import { z } from "zod";
import { Schedule, Trainer, Appointment } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { httpError, oid, parse, wrap } from "../utils/http.js";
import { audit } from "../utils/audit.js";
import { dateStr } from "../utils/schemas.js";
import { SLOT_MINUTES, OPEN_HOUR, CLOSE_HOUR, ACTIVE_APPT } from "../utils/config.js";
import { addMinutes, endOfVnDay, parseVnDate, startOfVnDay, vnMinutes } from "../utils/time.js";

const router = Router();
router.use(auth);

// BR.02: trong giờ mở cửa, slot 60 phút, bắt đầu ở tương lai
function assertSlotTime(startAt) {
  if (startAt <= new Date()) throw httpError(422, "Thời gian bắt đầu phải ở tương lai");
  const m = vnMinutes(startAt);
  if (m < OPEN_HOUR * 60 || m + SLOT_MINUTES > CLOSE_HOUR * 60)
    throw httpError(422, `Slot phải nằm trong giờ mở cửa (${OPEN_HOUR}:00 - ${CLOSE_HOUR}:00)`);
}

async function assertNoOverlap(trainerId, startAt, endAt, exceptId) {
  const clash = await Schedule.exists({
    trainerId,
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  });
  if (clash) throw httpError(409, "Slot bị chồng với lịch làm việc khác của HLV");
}

async function assertTrainer(id) {
  const t = await Trainer.findById(oid(id, "trainerId"));
  if (!t) throw httpError(404, "Không tìm thấy HLV");
  if (!t.isActive) throw httpError(422, "HLV đã ngừng hoạt động");
  return t;
}

// F.3.10 Tìm kiếm lịch làm việc (HLV/ngày/trạng thái). Hội viên chỉ thấy slot còn mở trong tương lai.
router.get(
  "/",
  wrap(async (req, res) => {
    const { trainerId, date, from, to, status } = req.query;
    const filter = {};
    if (trainerId) filter.trainerId = oid(trainerId, "trainerId");
    if (date) {
      const d = parseVnDate(String(date));
      if (!d) throw httpError(400, "date phải có dạng YYYY-MM-DD");
      filter.startAt = { $gte: d, $lte: endOfVnDay(d) };
    } else if (from || to) {
      filter.startAt = {};
      if (from) filter.startAt.$gte = new Date(String(from));
      if (to) filter.startAt.$lte = new Date(String(to));
    }
    if (status === "available") filter.bookedSlots = 0;
    if (status === "booked") filter.bookedSlots = 1;

    if (req.user.role === "member") {
      filter.isOpen = true;
      filter.startAt = { ...(filter.startAt || {}), $gt: new Date() };
      filter.bookedSlots = status === "booked" ? 1 : filter.bookedSlots ?? { $gte: 0 }; // hiện cả slot đã đặt để hiển thị "mờ"
    }
    const items = await Schedule.find(filter).sort({ startAt: 1 }).limit(500).populate("trainerId", "code fullName isActive");
    res.json(items);
  })
);

// F.3.11 Thêm lịch làm việc (1 slot)
router.post(
  "/",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(z.object({ trainerId: z.string(), startAt: z.coerce.date() }), req.body);
    const t = await assertTrainer(d.trainerId);
    assertSlotTime(d.startAt);
    const endAt = addMinutes(d.startAt, SLOT_MINUTES);
    await assertNoOverlap(t._id, d.startAt, endAt);
    res.status(201).json(await Schedule.create({ trainerId: t._id, startAt: d.startAt, endAt }));
  })
);

// Thêm nhiều slot trong một ngày: { trainerId, date:"2026-10-25", startHours:[8,9,10] }
router.post(
  "/bulk",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(
      z.object({ trainerId: z.string(), date: dateStr, startHours: z.array(z.number().int().min(0).max(23)).min(1).max(24) }),
      req.body
    );
    const t = await assertTrainer(d.trainerId);
    const day = parseVnDate(d.date);
    if (!day) throw httpError(400, "Ngày không hợp lệ");
    const created = [];
    const skipped = [];
    for (const h of [...new Set(d.startHours)].sort((a, b) => a - b)) {
      const startAt = addMinutes(day, h * 60);
      const endAt = addMinutes(startAt, SLOT_MINUTES);
      try {
        assertSlotTime(startAt);
        await assertNoOverlap(t._id, startAt, endAt);
        created.push(await Schedule.create({ trainerId: t._id, startAt, endAt }));
      } catch (e) {
        skipped.push({ hour: h, reason: e.message });
      }
    }
    res.status(201).json({ created, skipped });
  })
);

// ---- Thiết lập giờ làm việc theo khoảng ngày (Admin cho bất kỳ HLV; HLV chỉ cho chính mình)
const rangeBody = z.object({
  trainerId: z.string().optional(), // chỉ Admin cần gửi; HLV luôn dùng hồ sơ của mình
  fromDate: dateStr,
  toDate: dateStr,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Chọn ít nhất một ngày trong tuần"), // 0 = Chủ nhật
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24), // giờ kết thúc (không tính), slot cuối bắt đầu lúc endHour - 1
});

async function trainerForRange(user, trainerId) {
  if (user.role === "trainer") {
    const t = await Trainer.findOne({ userId: user._id });
    if (!t) throw httpError(403, "Tài khoản chưa gắn với hồ sơ HLV");
    if (!t.isActive) throw httpError(422, "HLV đã ngừng hoạt động");
    return t;
  }
  if (!trainerId) throw httpError(422, "Vui lòng chọn huấn luyện viên");
  return assertTrainer(trainerId);
}

// Trả về danh sách thời điểm bắt đầu slot theo điều kiện lặp
function expandRange(d) {
  const from = parseVnDate(d.fromDate);
  const to = parseVnDate(d.toDate);
  if (!from || !to) throw httpError(400, "Ngày không hợp lệ");
  if (to < from) throw httpError(422, "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu");
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > 62) throw httpError(422, "Mỗi lần chỉ thiết lập tối đa 62 ngày");
  if (d.endHour <= d.startHour) throw httpError(422, "Giờ kết thúc phải sau giờ bắt đầu");
  const starts = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(from.getTime() + i * 86400000);
    const wd = new Date(day.getTime() + 7 * 3600000).getUTCDay();
    if (!d.weekdays.includes(wd)) continue;
    for (let h = d.startHour; h < d.endHour; h++) starts.push(addMinutes(day, h * 60));
  }
  return { from, to, starts };
}

router.post(
  "/range",
  requireRole("admin", "trainer"),
  wrap(async (req, res) => {
    const d = parse(rangeBody, req.body);
    const t = await trainerForRange(req.user, d.trainerId);
    const { from, to, starts } = expandRange(d);
    const existing = await Schedule.find({ trainerId: t._id, startAt: { $gte: addMinutes(from, -SLOT_MINUTES), $lte: addMinutes(to, 24 * 60 + SLOT_MINUTES) } }).select("startAt endAt");
    const reasons = {};
    const skip = (r) => (reasons[r] = (reasons[r] || 0) + 1);
    const docs = [];
    for (const startAt of starts) {
      const endAt = addMinutes(startAt, SLOT_MINUTES);
      try {
        assertSlotTime(startAt);
      } catch (e) {
        skip(e.message);
        continue;
      }
      if (existing.some((x) => x.startAt < endAt && x.endAt > startAt)) {
        skip("Khung giờ đã có sẵn");
        continue;
      }
      docs.push({ trainerId: t._id, startAt, endAt });
    }
    let created = 0;
    if (docs.length) {
      try {
        created = (await Schedule.insertMany(docs, { ordered: false })).length;
      } catch (e) {
        created = e.insertedDocs?.length ?? 0; // một số slot trùng do gửi đồng thời: bỏ qua
      }
    }
    if (created) await audit(req.user._id, "schedule.range", "Trainer", t._id, { code: t.code, created, from: d.fromDate, to: d.toDate });
    res.status(201).json({ created, skipped: starts.length - created, reasons });
  })
);

// Gỡ các khung giờ còn trống trong khoảng (slot đã có lịch, hoặc từng có lịch, được giữ lại)
router.post(
  "/range/remove",
  requireRole("admin", "trainer"),
  wrap(async (req, res) => {
    const d = parse(rangeBody, req.body);
    const t = await trainerForRange(req.user, d.trainerId);
    const { starts } = expandRange(d);
    if (!starts.length) return res.json({ removed: 0, kept: 0 });
    const slots = await Schedule.find({ trainerId: t._id, startAt: { $in: starts } }).select("_id bookedSlots");
    const used = new Set((await Appointment.distinct("scheduleId", { scheduleId: { $in: slots.map((x) => x._id) } })).map(String));
    const removable = slots.filter((x) => x.bookedSlots === 0 && !used.has(String(x._id))).map((x) => x._id);
    if (removable.length) await Schedule.deleteMany({ _id: { $in: removable } });
    if (removable.length) await audit(req.user._id, "schedule.remove", "Trainer", t._id, { code: t.code, removed: removable.length });
    res.json({ removed: removable.length, kept: slots.length - removable.length });
  })
);

// F.3.12 Sửa lịch: không đổi giờ slot đang có lịch hoạt động; có thể ngừng nhận lịch mới
router.patch(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(z.object({ startAt: z.coerce.date().optional(), isOpen: z.boolean().optional() }), req.body);
    const s = await Schedule.findById(oid(req.params.id));
    if (!s) throw httpError(404, "Không tìm thấy lịch làm việc");
    if (d.startAt) {
      if (s.bookedSlots > 0) throw httpError(409, "Slot đang có lịch hoạt động. Hãy xử lý (hủy) lịch trước khi đổi giờ.");
      assertSlotTime(d.startAt);
      const endAt = addMinutes(d.startAt, SLOT_MINUTES);
      await assertNoOverlap(s.trainerId, d.startAt, endAt, s._id);
      s.startAt = d.startAt;
      s.endAt = endAt;
    }
    if (d.isOpen !== undefined) s.isOpen = d.isOpen;
    await s.save();
    res.json(s);
  })
);

// F.3.13 Xóa lịch: không xóa slot có lịch / đã phát sinh lịch (BR.09)
router.delete(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const s = await Schedule.findById(oid(req.params.id));
    if (!s) throw httpError(404, "Không tìm thấy lịch làm việc");
    if (s.bookedSlots > 0 || (await Appointment.exists({ scheduleId: s._id, status: { $in: ACTIVE_APPT } })))
      throw httpError(409, "Slot đang có lịch hoạt động, không thể xóa. Có thể ngừng nhận lịch mới.");
    if (await Appointment.exists({ scheduleId: s._id }))
      throw httpError(409, "Slot đã phát sinh lịch trước đó, không thể xóa. Hãy ngừng nhận lịch mới (isOpen=false).");
    await s.deleteOne();
    res.json({ message: "Đã xóa lịch làm việc" });
  })
);

export default router;
