import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, Member } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { escapeRegex, httpError, oid, parse, wrap } from "../utils/http.js";
import { emailSchema, passwordSchema, fullNameSchema, phoneSchema } from "../utils/schemas.js";
import { createMemberProfile } from "../services/members.js";
import { audit } from "../utils/audit.js";

const router = Router();
router.use(auth, requireRole("admin"));

const ASSIGNABLE = ["trainer", "member"];

async function getTarget(id) {
  const u = await User.findOne({ _id: oid(id), deletedAt: null }).select("+tokenVersion");
  if (!u) throw httpError(404, "Không tìm thấy tài khoản");
  return u;
}

// F.2.1 / F.2.2 Xem danh sách + tìm kiếm (theo tên/email)
router.get(
  "/",
  wrap(async (req, res) => {
    const { q, role, isActive, page = 1, limit = 50 } = req.query;
    const filter = { deletedAt: null };
    if (role) filter.role = role;
    if (isActive === "true" || isActive === "false") filter.isActive = isActive === "true";
    if (q) {
      const rx = new RegExp(escapeRegex(String(q).trim()), "i");
      filter.$or = [{ fullName: rx }, { email: rx }];
    }
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * lim;
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
      User.countDocuments(filter),
    ]);
    res.json({ items, total, page: Number(page) || 1, limit: lim });
  })
);

// F.2.3 Thêm tài khoản (email duy nhất, họ tên 1-100, mật khẩu hợp lệ, vai trò cho phép)
router.post(
  "/",
  wrap(async (req, res) => {
    const d = parse(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        fullName: fullNameSchema,
        phone: phoneSchema.optional(),
        role: z.enum(ASSIGNABLE, { message: "Vai trò không hợp lệ" }),
      }),
      req.body
    );
    if (await User.exists({ email: d.email })) throw httpError(409, "Email này đã được sử dụng.");
    const user = await User.create({
      email: d.email,
      fullName: d.fullName,
      phone: d.phone,
      role: d.role,
      passwordHash: await bcrypt.hash(d.password, 10),
    });
    if (d.role === "member") {
      try {
        await createMemberProfile({ userId: user._id, fullName: d.fullName, email: d.email, phone: d.phone });
      } catch (e) {
        await User.deleteOne({ _id: user._id });
        throw e;
      }
    }
    await audit(req.user._id, "user.create", "User", user._id, { role: d.role });
    res.status(201).json(user);
  })
);

// F.2.5 Sửa tài khoản / khóa - mở khóa
router.patch(
  "/:id",
  wrap(async (req, res) => {
    const d = parse(
      z.object({
        fullName: fullNameSchema.optional(),
        phone: phoneSchema.optional(),
        email: emailSchema.optional(),
        password: passwordSchema.optional(),
        isActive: z.boolean().optional(),
        reason: z.string().trim().max(300).optional(),
      }),
      req.body
    );
    const u = await getTarget(req.params.id);
    if (u.role === "admin" && !u._id.equals(req.user._id)) throw httpError(403, "Không thể sửa tài khoản Admin khác");
    if (d.isActive === false && u._id.equals(req.user._id)) throw httpError(422, "Không thể tự khóa tài khoản của mình");

    if (d.email && d.email !== u.email) {
      if (await User.exists({ email: d.email, _id: { $ne: u._id } })) throw httpError(409, "Email này đã được sử dụng.");
      u.email = d.email;
    }
    if (d.fullName !== undefined) u.fullName = d.fullName;
    if (d.phone !== undefined) u.phone = d.phone;
    if (d.password) {
      u.passwordHash = await bcrypt.hash(d.password, 10);
      u.tokenVersion += 1;
    }
    if (d.isActive !== undefined && d.isActive !== u.isActive) {
      u.isActive = d.isActive;
      if (!d.isActive) u.tokenVersion += 1; // khóa tài khoản thu hồi phiên
      await audit(req.user._id, d.isActive ? "user.unlock" : "user.lock", "User", u._id, { reason: d.reason });
    }
    await u.save();

    if (u.role === "member") {
      await Member.updateOne({ userId: u._id }, { fullName: u.fullName, phone: u.phone, email: u.email });
    }
    res.json(u);
  })
);

// F.2.6 Phân quyền tài khoản
router.patch(
  "/:id/role",
  wrap(async (req, res) => {
    const { role } = parse(z.object({ role: z.enum(ASSIGNABLE, { message: "Vai trò không hợp lệ" }) }), req.body);
    const u = await getTarget(req.params.id);
    if (u.role === "admin") throw httpError(403, "Không thể đổi vai trò của Admin");
    const old = u.role;
    if (old === role) return res.json(u);
    if (role === "member" && !(await Member.exists({ userId: u._id }))) {
      await createMemberProfile({ userId: u._id, fullName: u.fullName, email: u.email, phone: u.phone });
    }
    u.role = role;
    u.tokenVersion += 1; // buộc đăng nhập lại để nhận quyền mới
    await u.save();
    await audit(req.user._id, "user.role", "User", u._id, { from: old, to: role });
    res.json(u);
  })
);

// F.2.4 Xóa tài khoản = vô hiệu hóa (giữ lịch sử), biến mất khỏi danh sách hoạt động ngay, ghi audit
router.delete(
  "/:id",
  wrap(async (req, res) => {
    const u = await getTarget(req.params.id);
    if (u.role === "admin") throw httpError(403, "Không thể xóa tài khoản Admin");
    u.isActive = false;
    u.deletedAt = new Date();
    u.tokenVersion += 1;
    await u.save();
    await audit(req.user._id, "user.delete", "User", u._id, { email: u.email, role: u.role });
    res.json({ message: "Đã xóa (vô hiệu hóa) tài khoản" });
  })
);

export default router;
