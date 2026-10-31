import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Trainer, Package, User, Schedule, Appointment } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { escapeRegex, httpError, oid, parse, wrap } from "../utils/http.js";
import { emailSchema, passwordSchema, fullNameSchema } from "../utils/schemas.js";

const router = Router();
router.use(auth);

const codeSchema = z.string().trim().min(1, "Vui lòng nhập mã HLV").max(30).transform((s) => s.toUpperCase());
const idList = z.array(z.string()).default([]);

async function assertPackages(ids) {
  if (!ids.length) return;
  ids.forEach((id) => oid(id, "packageId"));
  const n = await Package.countDocuments({ _id: { $in: ids } });
  if (n !== new Set(ids).size) throw httpError(422, "Gói hỗ trợ không tồn tại");
}

// F.3.5 Tìm kiếm HLV (mã/tên/gói hỗ trợ/trạng thái). Không phải admin chỉ thấy HLV đang hoạt động.
router.get(
  "/",
  wrap(async (req, res) => {
    const { q, packageId, isActive } = req.query;
    const filter = {};
    if (req.user.role !== "admin") filter.isActive = true;
    else if (isActive === "true" || isActive === "false") filter.isActive = isActive === "true";
    if (packageId) filter.$or = [{ packageId: oid(packageId) }, { packageIds: oid(packageId) }];
    if (q) {
      const rx = new RegExp(escapeRegex(String(q).trim()), "i");
      filter.$and = [{ $or: [{ code: rx }, { fullName: rx }, { expertise: rx }] }];
    }
    const trainers = await Trainer.find(filter).sort({ fullName: 1 }).populate("packageId", "code name");
    // Hội viên không cần thấy liên hệ riêng của HLV
    res.json(
      req.user.role === "admin"
        ? trainers
        : trainers.map((t) => {
            const o = t.toObject();
            delete o.phone;
            delete o.email;
            return o;
          })
    );
  })
);

// HLV xem / sửa hồ sơ chuyên môn của chính mình (không đổi mã, trạng thái, gói)
router.get(
  "/me/profile",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const t = await Trainer.findOne({ userId: req.user._id });
    if (!t) throw httpError(404, "Tài khoản chưa gắn với hồ sơ HLV");
    res.json(t);
  })
);

router.patch(
  "/me/profile",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const d = parse(
      z.object({
        fullName: fullNameSchema.optional(),
        phone: z.string().trim().max(20).optional(),
        expertise: z.string().trim().max(200).optional(),
        bio: z.string().trim().max(1000).optional(),
        certificate: z.string().trim().max(200).optional(),
        experienceYears: z.number().min(0).max(80).optional(),
      }),
      req.body
    );
    const t = await Trainer.findOne({ userId: req.user._id });
    if (!t) throw httpError(404, "Tài khoản chưa gắn với hồ sơ HLV");
    Object.assign(t, d);
    await t.save();
    if (d.fullName !== undefined || d.phone !== undefined)
      await User.updateOne({ _id: req.user._id }, { ...(d.fullName !== undefined && { fullName: d.fullName }), ...(d.phone !== undefined && { phone: d.phone }) });
    res.json(t);
  })
);

router.get(
  "/:id",
  wrap(async (req, res) => {
    const t = await Trainer.findById(oid(req.params.id)).populate("packageId packageIds", "code name");
    if (!t || (req.user.role !== "admin" && !t.isActive)) throw httpError(404, "Không tìm thấy HLV");
    if (req.user.role === "admin") return res.json(t);
    const o = t.toObject(); // vai trò khác không thấy liên hệ riêng của HLV
    delete o.phone;
    delete o.email;
    res.json(o);
  })
);

const trainerBody = z.object({
  code: codeSchema,
  fullName: fullNameSchema,
  email: emailSchema.optional(),
  phone: z.string().trim().max(20).optional(),
  expertise: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(1000).optional(),
  certificate: z.string().trim().max(200).optional(),
  isActive: z.boolean().optional(),
  experienceYears: z.number().min(0).optional(),
  packageId: z.string().optional(),
  packageIds: idList,
  userId: z.string().optional(),
  password: passwordSchema.optional(), // nếu có: tạo luôn tài khoản đăng nhập vai trò HLV
});

// F.3.6 Thêm HLV
router.post(
  "/",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(trainerBody, req.body);
    const pkgIds = [...new Set([...(d.packageIds || []), ...(d.packageId ? [d.packageId] : [])])];
    await assertPackages(pkgIds);
    if (await Trainer.exists({ code: d.code })) throw httpError(409, "Mã HLV đã tồn tại");

    let userId = d.userId ? oid(d.userId, "userId") : undefined;
    let createdUser;
    if (userId) {
      const u = await User.findOne({ _id: userId, deletedAt: null });
      if (!u) throw httpError(422, "Tài khoản liên kết không tồn tại");
      if (await Trainer.exists({ userId })) throw httpError(409, "Tài khoản này đã gắn với HLV khác");
    } else if (d.password) {
      if (!d.email) throw httpError(422, "Cần email để tạo tài khoản HLV");
      if (await User.exists({ email: d.email })) throw httpError(409, "Email này đã được sử dụng.");
      createdUser = await User.create({
        email: d.email,
        fullName: d.fullName,
        phone: d.phone,
        role: "trainer",
        passwordHash: await bcrypt.hash(d.password, 10),
      });
      userId = createdUser._id;
    }
    try {
      const t = await Trainer.create({
        code: d.code,
        fullName: d.fullName,
        email: d.email,
        phone: d.phone,
        expertise: d.expertise,
        bio: d.bio,
        experienceYears: d.experienceYears,
        packageId: d.packageId || pkgIds[0],
        packageIds: pkgIds,
        userId,
      });
      res.status(201).json(t);
    } catch (e) {
      if (createdUser) await User.deleteOne({ _id: createdUser._id });
      throw e;
    }
  })
);

// F.3.7 Sửa HLV (bảo lưu lịch đã đặt - không đụng tới appointments)
router.patch(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const patchBody = trainerBody
      .omit({ password: true, packageIds: true })
      .partial()
      .extend({ packageIds: z.array(z.string()).optional() }); // không dùng default để PATCH không xóa nhầm danh sách gói
    const d = parse(patchBody, req.body);
    const t = await Trainer.findById(oid(req.params.id));
    if (!t) throw httpError(404, "Không tìm thấy HLV");
    if (d.code && d.code !== t.code && (await Trainer.exists({ code: d.code, _id: { $ne: t._id } })))
      throw httpError(409, "Mã HLV đã tồn tại");
    if (d.packageIds || d.packageId) {
      const ids = [...new Set([...(d.packageIds ?? t.packageIds.map(String)), ...(d.packageId ? [d.packageId] : [])])];
      await assertPackages(ids);
      t.packageIds = ids;
      t.packageId = d.packageId || t.packageId || ids[0];
    }
    for (const k of ["code", "fullName", "email", "phone", "expertise", "bio", "certificate", "experienceYears"]) {
      if (d[k] !== undefined) t[k] = d[k];
    }
    // Khóa / mở khóa HLV (giống DELETE: không khóa khi còn lịch chưa hoàn tất)
    if (d.isActive !== undefined && d.isActive !== t.isActive) {
      if (!d.isActive) {
        const open = await Appointment.countDocuments({ trainerId: t._id, status: { $in: ["Pending", "Confirmed", "CheckedIn"] }, endAt: { $gt: new Date() } });
        if (open > 0) throw httpError(409, `HLV còn ${open} lịch chưa hoàn tất. Hãy xử lý (hủy/từ chối) trước khi khóa.`);
        await Schedule.updateMany({ trainerId: t._id, bookedSlots: 0, startAt: { $gt: new Date() } }, { $set: { isOpen: false } });
      } else {
        await Schedule.updateMany({ trainerId: t._id, bookedSlots: 0, startAt: { $gt: new Date() } }, { $set: { isOpen: true } });
      }
      t.isActive = d.isActive;
    }
    if (d.userId) {
      oid(d.userId, "userId");
      if (await Trainer.exists({ userId: d.userId, _id: { $ne: t._id } })) throw httpError(409, "Tài khoản này đã gắn với HLV khác");
      t.userId = d.userId;
    }
    await t.save();
    res.json(t);
  })
);

// F.3.8 Xóa HLV = ngừng hoạt động sau khi xử lý lịch chưa hoàn tất
router.delete(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const t = await Trainer.findById(oid(req.params.id));
    if (!t) throw httpError(404, "Không tìm thấy HLV");
    const pending = await Appointment.countDocuments({
      trainerId: t._id,
      status: { $in: ["Pending", "Confirmed", "CheckedIn"] },
      endAt: { $gt: new Date() },
    });
    if (pending > 0) throw httpError(409, `HLV còn ${pending} lịch chưa hoàn tất. Hãy xử lý (hủy/chuyển) trước khi ngừng hoạt động.`);
    t.isActive = false;
    await t.save();
    await Schedule.updateMany({ trainerId: t._id, bookedSlots: 0, startAt: { $gt: new Date() } }, { $set: { isOpen: false } });
    res.json({ message: "Đã ngừng hoạt động HLV", trainer: t });
  })
);

// F.3.9 Nhập HLV từ Excel: client đọc file Excel -> gửi mảng dòng; server kiểm tra từng dòng.
// Không nhân đôi khi import lại: mã/email đã tồn tại sẽ báo lỗi dòng đó.
router.post(
  "/import",
  requireRole("admin"),
  wrap(async (req, res) => {
    const { rows } = parse(z.object({ rows: z.array(z.record(z.string(), z.any())).min(1).max(500) }), req.body);
    const pkgs = await Package.find({}, "code");
    const pkgByCode = new Map(pkgs.map((p) => [p.code, p._id]));
    const existing = await Trainer.find({}, "code email");
    const codes = new Set(existing.map((t) => t.code));
    const emails = new Set(existing.map((t) => t.email).filter(Boolean));

    const rowSchema = z.object({
      code: codeSchema,
      fullName: fullNameSchema,
      email: emailSchema.optional(),
      phone: z.string().trim().max(20).optional(),
      expertise: z.string().trim().max(200).optional(),
      packageCodes: z.string().optional(), // "BASIC,PREMIUM"
    });

    const errors = [];
    const created = [];
    for (let i = 0; i < rows.length; i++) {
      const line = i + 2; // dòng 1 là tiêu đề
      const clean = Object.fromEntries(
        Object.entries(rows[i]).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "").map(([k, v]) => [k, String(v)])
      );
      const r = rowSchema.safeParse(clean);
      if (!r.success) {
        errors.push({ row: line, message: r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
        continue;
      }
      const v = r.data;
      if (codes.has(v.code)) { errors.push({ row: line, message: `Mã HLV ${v.code} đã tồn tại hoặc bị trùng trong file` }); continue; }
      if (v.email && emails.has(v.email)) { errors.push({ row: line, message: `Email ${v.email} đã tồn tại hoặc bị trùng trong file` }); continue; }
      const pcodes = (v.packageCodes || "").split(/[,;]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      const missing = pcodes.filter((c) => !pkgByCode.has(c));
      if (missing.length) { errors.push({ row: line, message: `Gói không tồn tại: ${missing.join(", ")}` }); continue; }
      const ids = pcodes.map((c) => pkgByCode.get(c));
      try {
        const t = await Trainer.create({ code: v.code, fullName: v.fullName, email: v.email, phone: v.phone, expertise: v.expertise, packageId: ids[0], packageIds: ids });
        codes.add(v.code);
        if (v.email) emails.add(v.email);
        created.push({ row: line, id: t._id, code: t.code });
      } catch (e) {
        errors.push({ row: line, message: e.message });
      }
    }
    res.status(errors.length && !created.length ? 422 : 200).json({ total: rows.length, created: created.length, errors, items: created });
  })
);

export default router;
