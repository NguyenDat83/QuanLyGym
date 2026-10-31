import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User, Member, Trainer } from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { httpError, parse, wrap } from "../utils/http.js";
import { emailSchema, passwordSchema, fullNameSchema, phoneSchema } from "../utils/schemas.js";
import { createMemberProfile } from "../services/members.js";

const router = Router();

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "8h",
  });
}

async function profileOf(user) {
  if (user.role === "member") {
    const m = await Member.findOne({ userId: user._id }).select("code");
    return m ? { memberId: m._id, code: m.code } : null;
  }
  if (user.role === "trainer") {
    const t = await Trainer.findOne({ userId: user._id }).select("code");
    return t ? { trainerId: t._id, code: t.code } : null;
  }
  return null;
}

// F.1.1 Đăng nhập bằng email
router.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = parse(z.object({ email: emailSchema, password: z.string().min(1) }), req.body);
    const user = await User.findOne({ email, deletedAt: null }).select("+passwordHash +tokenVersion");
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!ok) throw httpError(401, "Email hoặc mật khẩu không chính xác.");
    if (!user.isActive) throw httpError(403, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên GYM PRO.");
    res.json({ token: signToken(user), user: user.toJSON(), profile: await profileOf(user) });
  })
);

// Hội viên tự đăng ký tài khoản
router.post(
  "/register",
  wrap(async (req, res) => {
    const d = parse(
      z.object({
        fullName: fullNameSchema,
        email: emailSchema,
        phone: phoneSchema,
        password: passwordSchema,
        dob: z.coerce.date().optional(),
        gender: z.string().trim().max(20).optional(),
        goal: z.string().trim().max(300).optional(),
      }),
      req.body
    );
    if (await User.exists({ email: d.email })) throw httpError(409, "Email này đã được sử dụng.");
    const user = await User.create({
      email: d.email,
      fullName: d.fullName,
      phone: d.phone,
      role: "member",
      passwordHash: await bcrypt.hash(d.password, 10),
    });
    try {
      const member = await createMemberProfile({
        userId: user._id,
        fullName: d.fullName,
        email: d.email,
        phone: d.phone,
        dob: d.dob,
        gender: d.gender,
        goal: d.goal,
      });
      res.status(201).json({ message: "Đăng ký tài khoản thành công!", memberCode: member.code });
    } catch (e) {
      await User.deleteOne({ _id: user._id }); // hoàn tác nếu tạo hồ sơ lỗi
      throw e;
    }
  })
);

router.get(
  "/me",
  auth,
  wrap(async (req, res) => {
    res.json({ user: req.user.toJSON(), profile: await profileOf(req.user) });
  })
);

// Token là stateless: client xóa token. Endpoint này để đồng nhất luồng đăng xuất.
router.post("/logout", auth, (_req, res) => res.json({ message: "Đã đăng xuất" }));

router.post(
  "/change-password",
  auth,
  wrap(async (req, res) => {
    const d = parse(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }), req.body);
    const user = await User.findById(req.user._id).select("+passwordHash +tokenVersion");
    if (!(await bcrypt.compare(d.currentPassword, user.passwordHash))) throw httpError(422, "Mật khẩu hiện tại không đúng");
    user.passwordHash = await bcrypt.hash(d.newPassword, 10);
    user.tokenVersion += 1; // thu hồi các phiên cũ
    await user.save();
    res.json({ message: "Đã đổi mật khẩu", token: signToken(user) });
  })
);

export default router;
