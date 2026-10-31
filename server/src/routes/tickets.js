import { Router } from "express";
import { z } from "zod";
import { Ticket, User } from "../models/index.js";
import { TICKET_STATUS, TICKET_CATEGORY, TICKET_PRIORITY } from "../models/Ticket.js";
import { auth, requireRole } from "../middleware/auth.js";
import { httpError, oid, parse, wrap } from "../utils/http.js";
import { adminIds, notify } from "../utils/notify.js";
import { audit } from "../utils/audit.js";

const router = Router();
router.use(auth);

const UI_ROLE = { admin: "ADMIN", trainer: "HLV", member: "HỘI VIÊN" };
const isAdmin = (u) => u.role === "admin";

async function nextCode() {
  const last = await Ticket.findOne().sort({ code: -1 }).select("code");
  const n = last ? parseInt(last.code.slice(2), 10) + 1 : 1;
  return `YC${String(n).padStart(5, "0")}`;
}

async function shape(tickets, viewer) {
  const ids = new Set();
  tickets.forEach((t) => {
    ids.add(String(t.senderId));
    if (t.assigneeId) ids.add(String(t.assigneeId));
    t.replies.forEach((r) => ids.add(String(r.senderId)));
  });
  const users = await User.find({ _id: { $in: [...ids] } }).select("fullName role");
  const u = new Map(users.map((x) => [String(x._id), x]));
  const name = (id) => u.get(String(id))?.fullName ?? "Tài khoản đã xóa";
  return tickets.map((t) => ({
    id: String(t._id),
    code: t.code,
    senderId: String(t.senderId),
    senderName: name(t.senderId),
    senderRole: UI_ROLE[u.get(String(t.senderId))?.role] ?? "",
    title: t.title,
    category: t.category,
    priority: t.priority,
    content: t.content,
    status: t.status,
    assigneeId: t.assigneeId ? String(t.assigneeId) : null,
    assigneeName: t.assigneeId ? name(t.assigneeId) : "",
    internalNote: isAdmin(viewer) ? t.internalNote : undefined,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    replies: t.replies.map((r) => ({ senderId: String(r.senderId), sender: name(r.senderId), body: r.body, createdAt: r.createdAt })),
  }));
}

async function load(id, user) {
  const t = await Ticket.findById(oid(id));
  if (!t) throw httpError(404, "Không tìm thấy yêu cầu");
  const mine = t.senderId.equals(user._id) || (t.assigneeId && t.assigneeId.equals(user._id));
  if (!isAdmin(user) && !mine) throw httpError(404, "Không tìm thấy yêu cầu");
  return t;
}

router.get(
  "/",
  wrap(async (req, res) => {
    const filter = isAdmin(req.user) ? {} : { $or: [{ senderId: req.user._id }, { assigneeId: req.user._id }] };
    res.json(await shape(await Ticket.find(filter).sort({ updatedAt: -1 }).limit(300), req.user));
  })
);

router.get(
  "/summary",
  requireRole("admin"),
  wrap(async (_req, res) => {
    res.json({ open: await Ticket.countDocuments({ status: { $nin: ["Đã giải quyết", "Đã đóng"] } }), unassignedNew: await Ticket.countDocuments({ status: "Mới" }) });
  })
);

// Hội viên và HLV tạo yêu cầu (Admin không tự tạo cho mình)
router.post(
  "/",
  requireRole("member", "trainer"),
  wrap(async (req, res) => {
    const d = parse(
      z.object({
        title: z.string().trim().min(1, "Vui lòng nhập tiêu đề").max(150),
        content: z.string().trim().min(1, "Vui lòng nhập nội dung").max(3000),
        category: z.enum(TICKET_CATEGORY).default("Khác"),
        priority: z.enum(TICKET_PRIORITY).default("Trung bình"),
      }),
      req.body
    );
    const admins = await adminIds();
    let t;
    for (let i = 0; i < 5 && !t; i++) {
      try {
        t = await Ticket.create({ ...d, code: await nextCode(), senderId: req.user._id, assigneeId: admins[0] });
      } catch (e) {
        if (e.code !== 11000) throw e; // trùng mã do tạo đồng thời: thử lại
      }
    }
    if (!t) throw httpError(409, "Không tạo được yêu cầu, vui lòng thử lại");
    await audit(req.user._id, "ticket.create", "Ticket", t._id, { code: t.code });
    await notify(admins, { icon: "help", title: "Yêu cầu hỗ trợ mới", body: `${t.code}: ${t.title}`, target: "support" });
    res.status(201).json((await shape([t], req.user))[0]);
  })
);

router.post(
  "/:id/replies",
  wrap(async (req, res) => {
    const { body } = parse(z.object({ body: z.string().trim().min(1, "Vui lòng nhập nội dung phản hồi").max(2000) }), req.body);
    const t = await load(req.params.id, req.user);
    if (t.status === "Đã đóng") throw httpError(409, "Yêu cầu đã đóng, không thể phản hồi thêm");
    t.replies.push({ senderId: req.user._id, body });
    if (isAdmin(req.user)) {
      if (t.status !== "Đã giải quyết") t.status = "Chờ phản hồi";
    } else if (!t.senderId.equals(req.user._id)) {
      // người được phân công (HLV) trả lời: giữ nguyên trạng thái
    } else if (t.status === "Chờ phản hồi" || t.status === "Đã giải quyết") {
      t.status = "Đang xử lý"; // người gửi phản hồi lại -> mở lại
    }
    await t.save();
    const targets = t.senderId.equals(req.user._id) ? [...(t.assigneeId ? [t.assigneeId] : []), ...(await adminIds())] : [t.senderId];
    await notify(targets.filter((x) => !x.equals(req.user._id)), { icon: "help", title: `Phản hồi yêu cầu ${t.code}`, body: body.slice(0, 100), target: "support" });
    res.status(201).json((await shape([t], req.user))[0]);
  })
);

// Admin: đổi trạng thái, người phụ trách, ghi chú nội bộ
router.patch(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(z.object({ status: z.enum(TICKET_STATUS).optional(), assigneeId: z.string().nullable().optional(), internalNote: z.string().max(2000).optional() }), req.body);
    const t = await load(req.params.id, req.user);
    const before = { status: t.status, assignee: t.assigneeId ? String(t.assigneeId) : null };
    if (d.assigneeId !== undefined) {
      if (d.assigneeId === null) t.assigneeId = undefined;
      else {
        const a = await User.findById(oid(d.assigneeId, "assigneeId"));
        if (!a || !a.isActive || a.deletedAt || a.role === "member") throw httpError(422, "Người phụ trách phải là Admin hoặc HLV đang hoạt động");
        t.assigneeId = a._id;
      }
    }
    if (d.status) t.status = d.status;
    if (d.internalNote !== undefined) t.internalNote = d.internalNote;
    await t.save();
    if (d.status && d.status !== before.status) {
      await audit(req.user._id, "ticket.status", "Ticket", t._id, { code: t.code, from: before.status, to: d.status });
      await notify(t.senderId, { icon: "help", title: `Yêu cầu ${t.code}: ${d.status}`, body: t.title, target: "support" });
    }
    if (d.assigneeId && String(t.assigneeId) !== before.assignee && !t.assigneeId.equals(req.user._id)) {
      await notify(t.assigneeId, { icon: "help", title: "Được phân công xử lý yêu cầu", body: `${t.code}: ${t.title}`, target: "support" });
    }
    res.json((await shape([t], req.user))[0]);
  })
);

export default router;
