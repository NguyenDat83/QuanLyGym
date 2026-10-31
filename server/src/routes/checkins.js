import { Router } from "express";
import { z } from "zod";
import { Appointment, Checkin, Member, Trainer } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { escapeRegex, httpError, oid, parse, wrap } from "../utils/http.js";
import { checkIn } from "../services/booking.js";
import { endOfVnDay, startOfVnDay } from "../utils/time.js";
import mongoose from "mongoose";
import { audit } from "../utils/audit.js";
import { apptUsers, apptWhen, notify } from "../utils/notify.js";

const router = Router();
router.use(auth);

// Chỉ trả các trường cần thiết cho màn hình check-in của Admin (F.5.2): không trả email/ngày sinh/địa chỉ/giáo án
const SLIM_MEMBER = "code fullName phone";

async function withCheckin(appts) {
  const ids = appts.map((a) => a._id);
  const cs = await Checkin.find({ appointmentId: { $in: ids } }).select("appointmentId checkInTime status");
  const map = new Map(cs.map((c) => [String(c.appointmentId), c]));
  return appts.map((a) => ({ ...a.toObject(), checkin: map.get(String(a._id)) ?? null }));
}

// F.5.1 Danh sách hội viên/lịch trong ngày
router.get(
  "/today",
  requireRole("admin"),
  wrap(async (_req, res) => {
    const now = new Date();
    const appts = await Appointment.find({
      startAt: { $gte: startOfVnDay(now), $lte: endOfVnDay(now) },
      status: { $in: ["Confirmed", "CheckedIn", "Completed", "NoShow"] },
    })
      .sort({ startAt: 1 })
      .populate("memberId", SLIM_MEMBER)
      .populate("trainerId", "code fullName");
    res.json(await withCheckin(appts));
  })
);

// F.5.2 Tìm hội viên theo mã/tên/điện thoại/mã lịch (chỉ lịch trong ngày hôm nay)
router.get(
  "/lookup",
  requireRole("admin"),
  wrap(async (req, res) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) throw httpError(400, "Nhập ít nhất 2 ký tự để tìm kiếm");
    const now = new Date();
    const day = { $gte: startOfVnDay(now), $lte: endOfVnDay(now) };
    let filter;
    if (mongoose.isValidObjectId(q) && q.length === 24) {
      filter = { _id: q }; // tra theo mã lịch hẹn đầy đủ
    } else if (/^[0-9a-f]{8}$/i.test(q)) {
      // mã lịch hẹn rút gọn 8 ký tự cuối (đúng mã hiển thị cho hội viên sau khi đặt lịch)
      filter = { startAt: day, $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: `${q}$`, options: "i" } } };
    } else {
      const rxText = new RegExp(escapeRegex(q), "i");
      const digits = q.replace(/\D/g, "");
      const or = [{ code: rxText }, { fullName: rxText }];
      if (digits.length >= 3) or.push({ phone: new RegExp(digits.split("").join("[ .()-]*")) }); // khớp SĐT có/không dấu cách
      const members = await Member.find({ $or: or }).select("_id").limit(50);
      filter = { memberId: { $in: members.map((m) => m._id) }, startAt: day };
    }
    const appts = await Appointment.find(filter)
      .sort({ startAt: 1 })
      .limit(50)
      .populate("memberId", SLIM_MEMBER)
      .populate("trainerId", "code fullName");
    res.json(await withCheckin(appts));
  })
);

// F.5.3 Xác nhận check-in (mỗi lịch một bản ghi; gửi lặp trả bản ghi gốc)
router.post(
  "/",
  requireRole("admin"),
  wrap(async (req, res) => {
    const { appointmentId } = parse(z.object({ appointmentId: z.string() }), req.body);
    const r = await checkIn({ userId: req.user._id, appointmentId: oid(appointmentId, "appointmentId") });
    if (!r.duplicate) {
      await audit(req.user._id, "checkin.create", "Appointment", appointmentId, { code: r.checkin?.code });
      const a = await Appointment.findById(appointmentId);
      if (a) {
        const u = await apptUsers(a);
        await notify(u.memberUserId, { icon: "check", title: "Check-in thành công", body: `Bạn đã check-in buổi tập lúc ${apptWhen(a.startAt)}.`, target: "checkin-history" });
        await notify(u.trainerUserId, { icon: "check", title: "Hội viên đã check-in", body: `${u.memberName} đã check-in, hãy ghi kết quả sau buổi tập.`, target: "trainer-dashboard" });
      }
    }
    res.status(r.duplicate ? 200 : 201).json({ checkin: r.checkin, duplicate: r.duplicate });
  })
);

// Lịch sử check-in của chính hội viên
router.get(
  "/mine",
  requireRole("member"),
  wrap(async (req, res) => {
    const m = await Member.findOne({ userId: req.user._id }).select("_id");
    if (!m) return res.json([]);
    const items = await Checkin.find({ memberId: m._id })
      .sort({ checkInTime: -1 })
      .limit(200)
      .populate({ path: "appointmentId", select: "startAt endAt status", populate: { path: "trainerId", select: "fullName" } });
    res.json(items);
  })
);

// Lịch sử check-in toàn hệ thống (Admin): lọc theo ngày, tìm theo mã/tên
router.get(
  "/history",
  requireRole("admin"),
  wrap(async (req, res) => {
    const { from, to, q, limit = 200 } = req.query;
    const filter = {};
    if (from || to) {
      filter.checkInTime = {};
      if (from) filter.checkInTime.$gte = new Date(String(from));
      if (to) filter.checkInTime.$lte = new Date(String(to));
    }
    if (q) {
      const rx = new RegExp(escapeRegex(String(q).trim()), "i");
      const ms = await Member.find({ $or: [{ code: rx }, { fullName: rx }, { phone: rx }] }).select("_id").limit(200);
      filter.memberId = { $in: ms.map((m) => m._id) };
    }
    const items = await Checkin.find(filter)
      .sort({ checkInTime: -1 })
      .limit(Math.min(Number(limit) || 200, 500))
      .populate("memberId", SLIM_MEMBER)
      .populate("trainerId", "code fullName")
      .populate("checkedInBy", "fullName");
    res.json(items);
  })
);

// F.5.4 HLV ghi kết quả buổi tập -> Completed (chỉ buổi do mình phụ trách)
router.post(
  "/:appointmentId/complete",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const d = parse(
      z.object({
        planId: z.string().optional(),
        planVersion: z.number().int().min(1).optional(),
        workoutLog: z
          .array(
            z.object({
              exerciseName: z.string().trim().min(1).max(100),
              actualSets: z.number().int().min(0).optional(),
              actualReps: z.number().int().min(0).optional(),
              loadKg: z.number().min(0).optional(),
              trainerNote: z.string().trim().max(500).optional(),
            })
          )
          .max(50)
          .default([]),
      }),
      req.body
    );
    const trainer = await Trainer.findOne({ userId: req.user._id }).select("_id");
    const a = await Appointment.findById(oid(req.params.appointmentId, "appointmentId"));
    if (!a) throw httpError(404, "Không tìm thấy lịch hẹn");
    if (!trainer || !a.trainerId.equals(trainer._id)) throw httpError(403, "Bạn không phụ trách buổi tập này");
    if (a.status === "Completed") return res.json({ appointment: a, duplicate: true });
    if (a.status !== "CheckedIn") throw httpError(409, "Chỉ ghi kết quả cho buổi đã check-in");

    const now = new Date();
    const upd = await Appointment.updateOne({ _id: a._id, status: "CheckedIn" }, { $set: { status: "Completed" } });
    if (upd.modifiedCount !== 1) throw httpError(409, "Buổi tập vừa thay đổi trạng thái");
    const c = await Checkin.findOneAndUpdate(
      { appointmentId: a._id },
      { $set: { status: "Completed", completedAt: now, workoutLog: d.workoutLog, planId: d.planId, planVersion: d.planVersion } },
      { returnDocument: "after" }
    );
    await audit(req.user._id, "checkin.complete", "Appointment", a._id, { exercises: d.workoutLog.length });
    const u = await apptUsers(a);
    await notify(u.memberUserId, { icon: "clipboard", title: "HLV đã ghi kết quả buổi tập", body: `Buổi tập lúc ${apptWhen(a.startAt)} đã hoàn thành.`, target: "progress" });
    res.json({ appointment: await Appointment.findById(a._id), checkin: c, duplicate: false });
  })
);

export default router;
