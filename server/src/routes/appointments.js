import { Router } from "express";
import { z } from "zod";
import { Appointment, Member, Trainer } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { httpError, oid, parse, wrap } from "../utils/http.js";
import { cancelBooking, createBooking, decideBooking } from "../services/booking.js";
import { audit } from "../utils/audit.js";
import { apptUsers, apptWhen, notify } from "../utils/notify.js";

const router = Router();
router.use(auth);

const POP = [
  { path: "trainerId", select: "code fullName expertise" },
  { path: "memberId", select: "code fullName phone" },
];

// Giới hạn phạm vi xem theo vai trò (hội viên chỉ thấy lịch của mình, HLV chỉ thấy lịch mình phụ trách)
async function scopeFilter(user) {
  if (user.role === "member") {
    const m = await Member.findOne({ userId: user._id }).select("_id");
    return { memberId: m?._id ?? null };
  }
  if (user.role === "trainer") {
    const t = await Trainer.findOne({ userId: user._id }).select("_id");
    return { trainerId: t?._id ?? null };
  }
  return {}; // admin (thay vai trò lễ tân)
}

// F.4.3 Xem lịch đã đặt (+ F.5.1 danh sách lịch trong ngày cho Admin qua from/to)
router.get(
  "/",
  wrap(async (req, res) => {
    const { status, from, to, memberId, trainerId, sort } = req.query;
    const filter = await scopeFilter(req.user);
    if (filter.memberId === null || filter.trainerId === null) return res.json([]);
    if (status) filter.status = { $in: String(status).split(",") };
    if (from || to) {
      filter.startAt = {};
      if (from) filter.startAt.$gte = new Date(String(from));
      if (to) filter.startAt.$lte = new Date(String(to));
    }
    if (req.user.role === "admin") {
      if (memberId) filter.memberId = oid(memberId, "memberId");
      if (trainerId) filter.trainerId = oid(trainerId, "trainerId");
    }
    const items = await Appointment.find(filter)
      .sort({ startAt: sort === "desc" ? -1 : 1 })
      .limit(500)
      .populate(POP);
    res.json(items);
  })
);

router.get(
  "/:id",
  wrap(async (req, res) => {
    const a = await Appointment.findById(oid(req.params.id)).populate(POP);
    if (!a) throw httpError(404, "Không tìm thấy lịch hẹn");
    const scope = await scopeFilter(req.user);
    if (scope.memberId !== undefined && String(a.memberId?._id) !== String(scope.memberId)) throw httpError(403, "Bạn không có quyền xem lịch hẹn này");
    if (scope.trainerId !== undefined && String(a.trainerId?._id) !== String(scope.trainerId)) throw httpError(403, "Bạn không có quyền xem lịch hẹn này");
    res.json(a);
  })
);

// F.4.2 Đặt lịch tập cá nhân (memberId lấy từ phiên đăng nhập, không lấy từ body)
router.post(
  "/",
  requireRole("member"),
  wrap(async (req, res) => {
    const d = parse(
      z.object({
        scheduleId: z.string(),
        subscriptionId: z.string().optional(),
        requestId: z.string().trim().min(8).max(100).optional(),
        note: z.string().trim().max(300).optional(),
      }),
      req.body
    );
    oid(d.scheduleId, "scheduleId");
    const r = await createBooking({ userId: req.user._id, ...d });
    const appt = await Appointment.findById(r.appointment._id).populate(POP);
    if (!r.duplicate) {
      const u = await apptUsers(appt);
      await notify(u.trainerUserId, { icon: "calendar", title: "Lịch mới chờ xác nhận", body: `${u.memberName} đặt lịch lúc ${apptWhen(appt.startAt)}.`, target: "trainer-dashboard" });
    }
    res.status(r.duplicate ? 200 : 201).json({ appointment: appt, duplicate: r.duplicate });
  })
);

// F.4.3 Hủy lịch (hội viên: trước ≥ 2 giờ; Admin: ngoại lệ có lý do)
router.post(
  "/:id/cancel",
  requireRole("member", "admin"),
  wrap(async (req, res) => {
    const d = parse(z.object({ reason: z.string().trim().max(300).optional(), refund: z.boolean().optional() }), req.body);
    const r = await cancelBooking({ user: req.user, appointmentId: oid(req.params.id), ...d });
    if (req.user.role === "admin" && !r.duplicate) {
      await audit(req.user._id, "appointment.cancel", "Appointment", r.appointment._id, { reason: d.reason, refunded: r.refunded });
    }
    const appt = await Appointment.findById(r.appointment._id).populate(POP);
    if (!r.duplicate) {
      const u = await apptUsers(appt);
      const body = `Lịch lúc ${apptWhen(appt.startAt)} (${u.memberName}) đã được hủy.`;
      const targets = req.user.role === "admin" ? [u.memberUserId, u.trainerUserId] : [u.trainerUserId];
      await notify(targets, { icon: "calendar", title: "Lịch tập đã hủy", body, target: req.user.role === "admin" ? "schedule" : "trainer-schedule" });
    }
    res.json({ appointment: appt, duplicate: r.duplicate, refunded: r.refunded ?? appt.refunded });
  })
);

// HLV (hoặc Admin) duyệt / từ chối yêu cầu đặt lịch đang chờ
for (const action of ["confirm", "reject"]) {
  router.post(
    `/:id/${action}`,
    requireRole("trainer", "admin"),
    wrap(async (req, res) => {
      const d = parse(z.object({ reason: z.string().trim().max(300).optional() }), req.body);
      if (action === "reject" && !d.reason) throw httpError(422, "Vui lòng nhập lý do từ chối");
      const r = await decideBooking({ user: req.user, appointmentId: oid(req.params.id), action, reason: d.reason });
      if (!r.duplicate) await audit(req.user._id, `appointment.${action}`, "Appointment", r.appointment._id, { reason: d.reason });
      const appt = await Appointment.findById(r.appointment._id).populate(POP);
      if (!r.duplicate) {
        const u = await apptUsers(appt);
        await notify(u.memberUserId, {
          icon: "calendar",
          title: action === "confirm" ? "Lịch đã được xác nhận" : "Yêu cầu đặt lịch bị từ chối",
          body: action === "confirm" ? `Buổi tập lúc ${apptWhen(appt.startAt)} với ${u.trainerName} đã được xác nhận.` : `Buổi tập lúc ${apptWhen(appt.startAt)} bị từ chối: ${d.reason}. Buổi PT đã được hoàn lại.`,
          target: "schedule",
        });
      }
      res.json({ appointment: appt, duplicate: r.duplicate });
    })
  );
}

// Ghi nhận không đến (no-show): sau giờ kết thúc, không tự hoàn buổi (BR.04)
router.post(
  "/:id/no-show",
  requireRole("admin"),
  wrap(async (req, res) => {
    const a = await Appointment.findById(oid(req.params.id));
    if (!a) throw httpError(404, "Không tìm thấy lịch hẹn");
    if (a.status === "NoShow") return res.json({ appointment: a, duplicate: true });
    if (a.status !== "Confirmed") throw httpError(409, `Không thể ghi no-show cho lịch ở trạng thái ${a.status}`);
    if (a.endAt > new Date()) throw httpError(422, "Chỉ ghi no-show sau khi buổi tập kết thúc");
    const upd = await Appointment.updateOne({ _id: a._id, status: "Confirmed" }, { $set: { status: "NoShow" } });
    if (upd.modifiedCount !== 1) throw httpError(409, "Lịch hẹn vừa thay đổi, vui lòng tải lại");
    await audit(req.user._id, "appointment.noshow", "Appointment", a._id, {});
    const u = await apptUsers(a);
    await notify(u.memberUserId, { icon: "calendar", title: "Buổi tập bị ghi nhận không đến", body: `Buổi tập lúc ${apptWhen(a.startAt)} được ghi nhận là không đến.`, target: "schedule" });
    res.json({ appointment: await Appointment.findById(a._id).populate(POP) });
  })
);

export default router;
