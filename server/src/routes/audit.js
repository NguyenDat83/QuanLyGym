import { Router } from "express";
import { AuditLog, User } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { escapeRegex, wrap } from "../utils/http.js";

const router = Router();
router.use(auth, requireRole("admin"));

const LABEL = {
  "user.create": "Tạo tài khoản",
  "user.lock": "Khóa tài khoản",
  "user.unlock": "Mở khóa tài khoản",
  "user.role": "Đổi quyền tài khoản",
  "user.delete": "Xóa tài khoản",
  "appointment.cancel": "Hủy lịch hẹn",
  "appointment.confirm": "Xác nhận lịch hẹn",
  "appointment.reject": "Từ chối lịch hẹn",
  "appointment.noshow": "Ghi nhận không đến",
  "checkin.create": "Check-in hội viên",
  "checkin.complete": "Ghi kết quả buổi tập",
  "schedule.range": "Tạo khung giờ làm việc",
  "schedule.remove": "Gỡ khung giờ làm việc",
  "member.update": "Chỉnh sửa hồ sơ hội viên",
  "member.subscription": "Đăng ký gói cho hội viên",
  "payment.create": "Hội viên mua gói (mô phỏng)",
  "ticket.create": "Gửi yêu cầu hỗ trợ",
  "ticket.status": "Đổi trạng thái yêu cầu hỗ trợ",
};

// GET /api/audit-logs?q=&action=&from=&to=&page=&limit=
router.get(
  "/",
  wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = {};
    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.from || req.query.to) {
      filter.at = {};
      if (req.query.from) filter.at.$gte = new Date(String(req.query.from));
      if (req.query.to) filter.at.$lte = new Date(String(req.query.to));
    }
    if (req.query.q) {
      const re = new RegExp(escapeRegex(String(req.query.q)), "i");
      const actors = await User.find({ fullName: re }).select("_id");
      const codes = Object.entries(LABEL).filter(([, v]) => re.test(v)).map(([k]) => k);
      filter.$or = [{ actorId: { $in: actors.map((a) => a._id) } }, { action: { $in: codes } }, { action: re }];
    }
    const [total, rows] = await Promise.all([AuditLog.countDocuments(filter), AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit)]);
    const userIds = new Set(rows.map((r) => String(r.actorId)).filter((x) => x !== "undefined"));
    rows.forEach((r) => r.targetType === "User" && r.targetId && userIds.add(String(r.targetId)));
    const users = await User.find({ _id: { $in: [...userIds] } }).select("fullName role");
    const u = new Map(users.map((x) => [String(x._id), x]));
    const items = rows.map((r) => {
      const tu = r.targetType === "User" ? u.get(String(r.targetId)) : null;
      const object = r.detail?.code ? `${r.targetType} · ${r.detail.code}` : tu ? `${tu.fullName} (${tu.role})` : r.targetType ? `${r.targetType} · ${String(r.targetId).slice(-8)}` : "—";
      return {
        id: String(r._id),
        at: r.at,
        actor: r.actorId ? u.get(String(r.actorId))?.fullName ?? "Tài khoản đã xóa" : "Hệ thống",
        action: LABEL[r.action] ?? r.action,
        actionCode: r.action,
        object,
        detail: r.detail ?? {},
        result: "Thành công",
      };
    });
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  })
);

router.get("/actions", wrap(async (_req, res) => res.json(Object.entries(LABEL).map(([code, label]) => ({ code, label })))));

export default router;
