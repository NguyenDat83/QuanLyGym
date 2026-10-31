import { Router } from "express";
import { z } from "zod";
import { Package } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { escapeRegex, httpError, oid, parse, wrap } from "../utils/http.js";

const router = Router();
router.use(auth);

const codeSchema = z.string().trim().min(1, "Vui lòng nhập mã gói").max(30).transform((s) => s.toUpperCase());
const configSchema = z.object({
  price: z.number({ message: "Giá không hợp lệ" }).min(0, "Giá phải ≥ 0"),
  durationDays: z.number().int("Thời hạn phải là số nguyên").min(1, "Thời hạn phải > 0"),
  ptSessions: z.number().int("Số buổi PT phải là số nguyên").min(0, "Số buổi PT phải ≥ 0"),
  isActive: z.boolean().optional(),
});

// F.3.1 Tìm kiếm gói tập (mã/tên/trạng thái đang bán). Không phải admin chỉ thấy gói đang bán.
router.get(
  "/",
  wrap(async (req, res) => {
    const { q, isActive } = req.query;
    const filter = {};
    if (req.user.role !== "admin") filter["config.isActive"] = true;
    else if (isActive === "true" || isActive === "false") filter["config.isActive"] = isActive === "true";
    if (q) {
      const rx = new RegExp(escapeRegex(String(q).trim()), "i");
      filter.$or = [{ code: rx }, { name: rx }];
    }
    res.json(await Package.find(filter).sort({ "config.price": 1 }));
  })
);

router.get(
  "/:id",
  wrap(async (req, res) => {
    const p = await Package.findById(oid(req.params.id));
    if (!p || (req.user.role !== "admin" && !p.config.isActive)) throw httpError(404, "Không tìm thấy gói tập");
    res.json(p);
  })
);

// F.3.2 Thêm gói tập
router.post(
  "/",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(
      z.object({ code: codeSchema, name: z.string().trim().min(1, "Vui lòng nhập tên gói").max(100), description: z.string().trim().max(500).optional(), config: configSchema }),
      req.body
    );
    res.status(201).json(await Package.create(d));
  })
);

// F.3.3 Sửa gói: chỉ đổi danh mục, không ảnh hưởng snapshot của gói đã mua
router.patch(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const d = parse(
      z.object({ code: codeSchema.optional(), name: z.string().trim().min(1).max(100).optional(), description: z.string().trim().max(500).optional(), config: configSchema.partial().optional() }),
      req.body
    );
    const p = await Package.findById(oid(req.params.id));
    if (!p) throw httpError(404, "Không tìm thấy gói tập");
    if (d.code) p.code = d.code;
    if (d.name) p.name = d.name;
    if (d.description !== undefined) p.description = d.description;
    if (d.config) Object.assign(p.config, d.config);
    await p.save();
    res.json(p);
  })
);

// F.3.4 Xóa gói = ngừng bán, giữ gói đã có đăng ký/lịch hẹn (BR.09)
router.delete(
  "/:id",
  requireRole("admin"),
  wrap(async (req, res) => {
    const p = await Package.findById(oid(req.params.id));
    if (!p) throw httpError(404, "Không tìm thấy gói tập");
    p.config.isActive = false;
    await p.save();
    res.json({ message: "Đã ngừng bán gói tập", package: p });
  })
);

export default router;
