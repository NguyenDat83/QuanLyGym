import { Router } from "express";
import { z } from "zod";
import { Member, Package, User, Appointment, Checkin, Trainer } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { escapeRegex, httpError, oid, parse, wrap } from "../utils/http.js";
import { dateStr, emailSchema, fullNameSchema, phoneSchema } from "../utils/schemas.js";
import { parseVnDate, startOfVnDay, subscriptionEnd } from "../utils/time.js";
import { summarizeMember } from "../services/members.js";
import { audit } from "../utils/audit.js";
import { notify } from "../utils/notify.js";

const router = Router();
router.use(auth);

const profileFields = z.object({
  fullName: fullNameSchema.optional(),
  phone: phoneSchema.optional(),
  dob: z.coerce.date().optional(),
  gender: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  goal: z.string().trim().max(300).optional(),
  experienceLevel: z.string().trim().max(50).optional(),
});

// F.4.1 Hội viên xem hồ sơ của chính mình (kèm gói hiện tại)
router.get(
  "/me",
  requireRole("member"),
  wrap(async (req, res) => {
    const m = await Member.findOne({ userId: req.user._id });
    if (!m) throw httpError(404, "Chưa có hồ sơ hội viên");
    res.json(summarizeMember(m));
  })
);

// F.4.1 Cập nhật hồ sơ, mục tiêu, kinh nghiệm - chỉ sửa hồ sơ của mình
router.patch(
  "/me",
  requireRole("member"),
  wrap(async (req, res) => {
    const d = parse(profileFields, req.body);
    const m = await Member.findOne({ userId: req.user._id });
    if (!m) throw httpError(404, "Chưa có hồ sơ hội viên");
    Object.assign(m, d);
    await m.save();
    if (d.fullName !== undefined || d.phone !== undefined) {
      await User.updateOne({ _id: req.user._id }, { ...(d.fullName !== undefined && { fullName: d.fullName }), ...(d.phone !== undefined && { phone: d.phone }) });
    }
    res.json(summarizeMember(m));
  })
);

// HLV: hội viên thuộc phạm vi phụ trách (đã được HLV xác nhận lịch, khớp BR.06 của giáo án)
router.get(
  "/assigned",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const t = await Trainer.findOne({ userId: req.user._id }).select("_id");
    if (!t) return res.json([]);
    const rows = await Appointment.aggregate([
      { $match: { trainerId: t._id, status: { $in: ["Confirmed", "CheckedIn", "Completed"] } } },
      { $group: { _id: "$memberId", total: { $sum: 1 }, last: { $max: "$startAt" } } },
    ]);
    const members = await Member.find({ _id: { $in: rows.map((r) => r._id) } });
    const stat = new Map(rows.map((r) => [String(r._id), r]));
    res.json(
      members.map((m) => {
        const o = summarizeMember(m);
        return { _id: o._id, code: o.code, fullName: o.fullName, goal: o.goal, planName: o.planName, planStatus: o.planStatus, remainingPt: o.remainingPt, sessions: stat.get(String(m._id))?.total ?? 0, lastSession: stat.get(String(m._id))?.last ?? null };
      })
    );
  })
);

// Danh sách hội viên (Admin): tìm theo mã/tên/email/điện thoại, lọc trạng thái tài khoản & gói
router.get(
  "/",
  requireRole("admin"),
  wrap(async (req, res) => {
    const { q, accountStatus, plan, joined, sort = "newest", page = 1, limit = 100 } = req.query;
    const filter = {};
    if (q) {
      const t = String(q).trim();
      const rx = new RegExp(escapeRegex(t), "i");
      const or = [{ code: rx }, { fullName: rx }, { email: rx }];
      const digits = t.replace(/\D/g, "");
      if (digits.length >= 3) or.push({ phone: new RegExp(digits.split("").join("[ .()-]*")) });
      filter.$or = or;
    }
    if (joined === "today") filter.createdAt = { $gte: startOfVnDay(new Date()) };
    if (joined === "7d") filter.createdAt = { $gte: new Date(Date.now() - 7 * 86400000) };

    let items = await Member.find(filter)
      .sort(sort === "name" ? { fullName: 1 } : { createdAt: -1 })
      .limit(500)
      .populate("userId", "isActive deletedAt");
    items = items.filter((m) => m.userId && !m.userId.deletedAt);

    const now = new Date();
    let out = items.map((m) => {
      const s = summarizeMember(m, now);
      return {
        ...s,
        userId: m.userId._id,
        accountStatus: m.userId.isActive ? "Đang hoạt động" : "Đã khóa",
        isActive: m.userId.isActive,
      };
    });
    if (accountStatus) out = out.filter((m) => m.accountStatus === accountStatus);
    if (plan) out = out.filter((m) => (plan === "Chưa đăng ký" ? m.planStatus === "Chưa đăng ký" : m.planName === plan));

    const lim = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
    res.json({ items: out.slice(skip, skip + lim), total: out.length });
  })
);

// Chi tiết hội viên (Admin): hồ sơ, gói, lịch sắp tới, check-in gần đây
router.get(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const m = await Member.findById(oid(req.params.id)).populate("userId", "isActive deletedAt");
    if (!m || m.userId?.deletedAt) throw httpError(404, "Không tìm thấy hội viên");
    const [appointments, checkins] = await Promise.all([
      Appointment.find({ memberId: m._id }).sort({ startAt: -1 }).limit(20).populate("trainerId", "code fullName"),
      Checkin.find({ memberId: m._id }).sort({ checkInTime: -1 }).limit(20),
    ]);
    res.json({
      member: { ...summarizeMember(m), accountStatus: m.userId.isActive ? "Đang hoạt động" : "Đã khóa", isActive: m.userId.isActive },
      appointments,
      checkins,
    });
  })
);

// Admin sửa thông tin hội viên
router.patch(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(profileFields.extend({ email: emailSchema.optional() }), req.body);
    const m = await Member.findById(oid(req.params.id));
    if (!m) throw httpError(404, "Không tìm thấy hội viên");
    if (d.email && d.email !== m.email) {
      if (await User.exists({ email: d.email, _id: { $ne: m.userId } })) throw httpError(409, "Email này đã được sử dụng.");
      await User.updateOne({ _id: m.userId }, { email: d.email });
    }
    Object.assign(m, d);
    await m.save();
    if (d.fullName !== undefined || d.phone !== undefined) {
      await User.updateOne({ _id: m.userId }, { ...(d.fullName !== undefined && { fullName: d.fullName }), ...(d.phone !== undefined && { phone: d.phone }) });
    }
    await audit(req.user._id, "member.update", "Member", m._id, { code: m.code, fields: Object.keys(d) });
    res.json(summarizeMember(m));
  })
);

// F.5.5 Đăng ký / gia hạn gói tập (Admin): lưu snapshot giá/quota, tạo subscription mới, không ghi đè gói cũ (BR.07)
router.post(
  "/:id/subscriptions",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(z.object({ packageId: z.string(), startDate: dateStr.optional() }), req.body);
    const m = await Member.findById(oid(req.params.id));
    if (!m) throw httpError(404, "Không tìm thấy hội viên");
    const user = await User.findById(m.userId);
    if (!user?.isActive) throw httpError(422, "Tài khoản hội viên đang bị khóa");
    const pkg = await Package.findById(oid(d.packageId, "packageId"));
    if (!pkg || !pkg.config.isActive) throw httpError(422, "Gói tập không tồn tại hoặc đã ngừng bán");

    const startDate = d.startDate ? parseVnDate(d.startDate) : startOfVnDay(new Date());
    if (!startDate) throw httpError(422, "Ngày bắt đầu không hợp lệ");
    if (startDate < startOfVnDay(new Date())) throw httpError(422, "Ngày bắt đầu không được ở quá khứ");

    m.subscriptions.push({
      packageId: pkg._id,
      packageCode: pkg.code,
      packageName: pkg.name,
      priceSnapshot: pkg.config.price,
      startDate,
      endDate: subscriptionEnd(startDate, pkg.config.durationDays),
      totalPt: pkg.config.ptSessions,
      usedPt: 0,
      status: "Active",
      createdBy: req.user._id,
    });
    await m.save();
    await audit(req.user._id, "member.subscription", "Member", m._id, { code: m.code, package: pkg.code });
    await notify(m.userId, { icon: "card", title: "Gói hội viên đã được đăng ký", body: `Gói ${pkg.name} có hiệu lực từ ${startDate.toISOString().slice(0, 10)}.`, target: "membership" });
    res.status(201).json(summarizeMember(m));
  })
);

export default router;
