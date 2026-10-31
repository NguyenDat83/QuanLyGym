import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Member, Package, Payment, ResourceLock, User } from "../models/index.js";
import { PAY_METHODS } from "../models/Payment.js";
import { auth, requireRole } from "../middleware/auth.js";
import { escapeRegex, httpError, oid, parse, wrap } from "../utils/http.js";
import { addDays, startOfVnDay, subscriptionEnd } from "../utils/time.js";
import { audit } from "../utils/audit.js";
import { adminIds, notify } from "../utils/notify.js";
import { summarizeMember } from "../services/members.js";

const router = Router();
router.use(auth);

const money = (n) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

async function nextCode(session) {
  const last = await Payment.findOne().sort({ code: -1 }).select("code").session(session ?? null);
  return "HD" + String((last ? parseInt(last.code.slice(2), 10) : 0) + 1).padStart(5, "0");
}

const shape = (p) => ({
  id: String(p._id),
  code: p.code,
  packageName: p.packageName,
  amount: p.amount,
  method: p.method,
  status: p.status,
  simulated: p.simulated,
  startDate: p.startDate,
  endDate: p.endDate,
  paidAt: p.paidAt,
});

// Xem trước: gói sẽ bắt đầu khi nào nếu mua bây giờ
function planStart(member, now) {
  const today = startOfVnDay(now);
  const live = member.subscriptions.filter((s) => s.status === "Active" && s.endDate >= now);
  if (!live.length) return { startDate: today, queued: false };
  const lastEnd = live.reduce((m, s) => (s.endDate > m ? s.endDate : m), live[0].endDate);
  return { startDate: startOfVnDay(addDays(lastEnd, 1)), queued: true };
}

// Hội viên mua gói (mô phỏng thanh toán thành công)
router.post(
  "/",
  requireRole("member"),
  wrap(async (req, res) => {
    const d = parse(z.object({ packageId: z.string(), method: z.enum(PAY_METHODS), requestId: z.string().trim().min(8).max(100) }), req.body);
    oid(d.packageId, "packageId");

    const dup = await Payment.findOne({ userId: req.user._id, requestId: d.requestId });
    const respond = async (payment, duplicate, status) => {
      const m = await Member.findOne({ userId: req.user._id });
      res.status(status).json({ payment: shape(payment), member: summarizeMember(m), duplicate });
    };
    if (dup) return respond(dup, true, 200);

    const session = await mongoose.startSession();
    let payment;
    let pkg;
    try {
      await session.withTransaction(
        async () => {
          const member = await Member.findOne({ userId: req.user._id }).session(session);
          if (!member) throw httpError(404, "Chưa có hồ sơ hội viên");
          const user = await User.findById(req.user._id).session(session);
          if (!user?.isActive) throw httpError(403, "Tài khoản đang bị khóa");
          pkg = await Package.findById(d.packageId).session(session);
          if (!pkg || !pkg.config.isActive) throw httpError(422, "Gói tập không tồn tại hoặc đã ngừng bán");

          // Khóa theo hội viên để hai lần mua đồng thời được xử lý lần lượt
          await ResourceLock.findOneAndUpdate({ _id: `purchase:${member._id}` }, { $inc: { revision: 1 } }, { upsert: true, session });
          const fresh = await Member.findById(member._id).session(session);
          const now = new Date();
          if (fresh.subscriptions.some((s) => s.status === "Active" && s.startDate > now))
            throw httpError(409, "Bạn đã có một gói đang chờ bắt đầu. Hãy dùng xong gói đó trước khi mua thêm.");
          const { startDate } = planStart(fresh, now);
          const endDate = subscriptionEnd(startDate, pkg.config.durationDays);

          const sub = {
            _id: new mongoose.Types.ObjectId(),
            packageId: pkg._id,
            packageCode: pkg.code,
            packageName: pkg.name,
            priceSnapshot: pkg.config.price,
            startDate,
            endDate,
            totalPt: pkg.config.ptSessions,
            usedPt: 0,
            status: "Active",
            createdBy: req.user._id,
          };
          fresh.subscriptions.push(sub);
          await fresh.save({ session });
          [payment] = await Payment.create(
            [{ code: await nextCode(session), memberId: member._id, userId: req.user._id, packageId: pkg._id, packageName: pkg.name, subscriptionId: sub._id, amount: pkg.config.price, method: d.method, requestId: d.requestId, startDate, endDate }],
            { session }
          );
        },
        { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }
      );
    } catch (e) {
      if (e.code === 11000) {
        const again = await Payment.findOne({ userId: req.user._id, requestId: d.requestId });
        if (again) return respond(again, true, 200);
        throw httpError(409, "Không tạo được hóa đơn, vui lòng thử lại");
      }
      throw e;
    } finally {
      await session.endSession();
    }

    await audit(req.user._id, "payment.create", "Payment", payment._id, { code: payment.code, package: pkg.code, amount: payment.amount });
    await notify(req.user._id, { icon: "card", title: "Thanh toán thành công", body: `Hóa đơn ${payment.code}: gói ${pkg.name} - ${money(payment.amount)}.`, target: "membership" });
    await notify(await adminIds(), { icon: "card", title: "Hội viên mua gói mới", body: `${req.user.fullName} mua gói ${pkg.name} (${payment.code}).`, target: "members" });
    return respond(payment, false, 201);
  })
);

router.get(
  "/preview",
  requireRole("member"),
  wrap(async (req, res) => {
    const m = await Member.findOne({ userId: req.user._id });
    if (!m) throw httpError(404, "Chưa có hồ sơ hội viên");
    const now = new Date();
    const { startDate, queued } = planStart(m, now);
    const blocked = m.subscriptions.some((s) => s.status === "Active" && s.startDate > now);
    res.json({ startDate, queued, blocked });
  })
);

router.get(
  "/mine",
  requireRole("member"),
  wrap(async (req, res) => {
    res.json((await Payment.find({ userId: req.user._id }).sort({ paidAt: -1 }).limit(100)).map(shape));
  })
);

// Admin: danh sách hóa đơn toàn hệ thống
router.get(
  "/",
  requireRole("admin"),
  wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = {};
    if (req.query.q) {
      const re = new RegExp(escapeRegex(String(req.query.q)), "i");
      const ms = await Member.find({ $or: [{ fullName: re }, { code: re }] }).select("_id");
      filter.$or = [{ code: re }, { memberId: { $in: ms.map((m) => m._id) } }];
    }
    const [total, rows] = await Promise.all([Payment.countDocuments(filter), Payment.find(filter).sort({ paidAt: -1 }).skip((page - 1) * limit).limit(limit)]);
    const ms = await Member.find({ _id: { $in: rows.map((r) => r.memberId) } }).select("code fullName");
    const mm = new Map(ms.map((m) => [String(m._id), m]));
    const revenue = (await Payment.aggregate([{ $match: filter }, { $group: { _id: null, sum: { $sum: "$amount" } } }]))[0]?.sum ?? 0;
    res.json({ items: rows.map((r) => ({ ...shape(r), memberCode: mm.get(String(r.memberId))?.code, memberName: mm.get(String(r.memberId))?.fullName })), total, page, pages: Math.ceil(total / limit), revenue });
  })
);

export default router;
