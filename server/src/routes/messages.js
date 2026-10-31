import { Router } from "express";
import { z } from "zod";
import { Conversation, Message, User, Member, Trainer } from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { httpError, oid, parse, wrap } from "../utils/http.js";
import { notify } from "../utils/notify.js";

const router = Router();
router.use(auth);

const UI_ROLE = { admin: "ADMIN", trainer: "HLV", member: "HỘI VIÊN" };
const pairKey = (a, b) => [String(a), String(b)].sort().join(":");

// Ai được nhắn cho ai: hội viên <-> HLV/Admin, HLV <-> Admin. Hội viên không nhắn hội viên.
const canChat = (a, b) => String(a._id) !== String(b._id) && !(a.role === "member" && b.role === "member") && !(a.role === "trainer" && b.role === "trainer");

async function codesFor(users) {
  const ids = users.map((u) => u._id);
  const [ms, ts] = await Promise.all([Member.find({ userId: { $in: ids } }).select("userId code"), Trainer.find({ userId: { $in: ids } }).select("userId code")]);
  const map = new Map();
  ms.forEach((m) => map.set(String(m.userId), m.code));
  ts.forEach((t) => map.set(String(t.userId), t.code));
  return map;
}

const brief = (u, codes) => ({ id: String(u._id), name: u.fullName, role: UI_ROLE[u.role], code: codes?.get(String(u._id)) ?? (u.role === "admin" ? "ADMIN" : "") });

router.get(
  "/contacts",
  wrap(async (req, res) => {
    const me = req.user;
    const roles = me.role === "admin" ? ["admin", "trainer", "member"] : me.role === "trainer" ? ["admin", "member"] : ["admin", "trainer"];
    const users = await User.find({ role: { $in: roles }, isActive: true, deletedAt: null, _id: { $ne: me._id } }).sort({ fullName: 1 }).limit(500);
    const codes = await codesFor(users);
    res.json(users.filter((u) => canChat(me, u)).map((u) => brief(u, codes)));
  })
);

async function loadConversation(id, user) {
  const c = await Conversation.findById(oid(id));
  if (!c || !c.participants.some((p) => p.equals(user._id))) throw httpError(404, "Không tìm thấy hội thoại");
  return c;
}

router.get(
  "/conversations",
  wrap(async (req, res) => {
    const me = req.user._id;
    const convs = await Conversation.find({ participants: me }).sort({ lastMessageAt: -1 }).limit(200);
    const otherIds = convs.map((c) => c.participants.find((p) => !p.equals(me)));
    const others = await User.find({ _id: { $in: otherIds } });
    const byId = new Map(others.map((u) => [String(u._id), u]));
    const codes = await codesFor(others);
    const unread = await Message.aggregate([
      { $match: { conversationId: { $in: convs.map((c) => c._id) }, senderId: { $ne: me }, readBy: { $ne: me } } },
      { $group: { _id: "$conversationId", n: { $sum: 1 } } },
    ]);
    const un = new Map(unread.map((x) => [String(x._id), x.n]));
    res.json(
      convs.map((c, i) => {
        const o = byId.get(String(otherIds[i]));
        return {
          id: String(c._id),
          other: o ? brief(o, codes) : { id: String(otherIds[i]), name: "Tài khoản đã xóa", role: "", code: "" },
          lastMessageAt: c.lastMessageAt,
          lastMessageText: c.lastMessageText,
          lastSenderId: c.lastSenderId ? String(c.lastSenderId) : null,
          unread: un.get(String(c._id)) ?? 0,
        };
      })
    );
  })
);

router.get(
  "/unread-count",
  wrap(async (req, res) => {
    const convs = await Conversation.find({ participants: req.user._id }).select("_id");
    const count = await Message.countDocuments({ conversationId: { $in: convs.map((c) => c._id) }, senderId: { $ne: req.user._id }, readBy: { $ne: req.user._id } });
    res.json({ count });
  })
);

// Tìm hoặc tạo hội thoại với một tài khoản
router.post(
  "/conversations",
  wrap(async (req, res) => {
    const { userId } = parse(z.object({ userId: z.string() }), req.body);
    const other = await User.findById(oid(userId, "userId"));
    if (!other || other.deletedAt || !other.isActive) throw httpError(404, "Không tìm thấy người nhận");
    if (!canChat(req.user, other)) throw httpError(403, "Bạn không thể nhắn tin cho tài khoản này");
    const key = pairKey(req.user._id, other._id);
    const c = await Conversation.findOneAndUpdate({ key }, { $setOnInsert: { key, participants: [req.user._id, other._id] } }, { upsert: true, returnDocument: "after" });
    res.status(200).json({ id: String(c._id) });
  })
);

router.get(
  "/conversations/:id/messages",
  wrap(async (req, res) => {
    const c = await loadConversation(req.params.id, req.user);
    const msgs = await Message.find({ conversationId: c._id }).sort({ createdAt: -1 }).limit(200);
    msgs.reverse();
    // mở hội thoại = đã đọc các tin của người kia
    await Message.updateMany({ conversationId: c._id, senderId: { $ne: req.user._id }, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
    res.json(msgs.map((m) => ({ id: String(m._id), senderId: String(m.senderId), body: m.body, createdAt: m.createdAt, readBy: m.readBy.map(String) })));
  })
);

router.post(
  "/conversations/:id/messages",
  wrap(async (req, res) => {
    const { body } = parse(z.object({ body: z.string().trim().min(1, "Tin nhắn không được để trống").max(2000) }), req.body);
    const c = await loadConversation(req.params.id, req.user);
    const otherId = c.participants.find((p) => !p.equals(req.user._id));
    const other = await User.findById(otherId);
    if (!other || other.deletedAt || !other.isActive) throw httpError(422, "Người nhận không còn hoạt động");
    const m = await Message.create({ conversationId: c._id, senderId: req.user._id, body, readBy: [req.user._id] });
    await Conversation.updateOne({ _id: c._id }, { $set: { lastMessageAt: m.createdAt, lastMessageText: body.slice(0, 120), lastSenderId: req.user._id } });
    await notify(otherId, { icon: "message", title: "Tin nhắn mới", body: `${req.user.fullName}: ${body.slice(0, 100)}`, target: "messages" });
    res.status(201).json({ id: String(m._id), senderId: String(m.senderId), body: m.body, createdAt: m.createdAt, readBy: m.readBy.map(String) });
  })
);

export default router;
