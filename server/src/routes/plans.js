import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Appointment, Member, Trainer } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { httpError, oid, parse, wrap } from "../utils/http.js";

const router = Router();
router.use(auth);

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "Tên bài tập không được trống").max(100),
  sets: z.number().int("Số hiệp phải là số nguyên dương").min(1, "Số hiệp phải ≥ 1"),
  reps: z.number().int("Số lần phải là số nguyên dương").min(1, "Số lần phải ≥ 1"),
  restSeconds: z.number().int().min(0, "Thời gian nghỉ phải ≥ 0"),
});
const planBody = z.object({
  goal: z.string().trim().max(300).optional(),
  weeks: z
    .array(
      z.object({
        week: z.number().int().min(1),
        days: z.array(z.object({ day: z.string().trim().min(1).max(50), title: z.string().trim().max(100).optional(), exercises: z.array(exerciseSchema).max(30) })).max(7),
      })
    )
    .min(1, "Giáo án cần ít nhất 1 tuần")
    .max(12),
});

async function myTrainer(user) {
  const t = await Trainer.findOne({ userId: user._id });
  if (!t) throw httpError(403, "Tài khoản chưa gắn với HLV");
  return t;
}

// BR.06: HLV chỉ làm việc với hội viên mình phụ trách (có lịch không bị hủy với HLV đó)
async function assertAssigned(trainerId, memberId) {
  const ok = await Appointment.exists({ memberId, trainerId, status: { $in: ["Confirmed", "CheckedIn", "Completed"] } });
  if (!ok) throw httpError(403, "Hội viên này không thuộc phụ trách của bạn");
}

async function loadMember(id) {
  const m = await Member.findById(oid(id, "memberId"));
  if (!m) throw httpError(404, "Không tìm thấy hội viên");
  return m;
}

// Hội viên chỉ xem bản Published (bản mới nhất mỗi giáo án) của chính mình (F.4.4)
router.get(
  "/mine",
  requireRole("member"),
  wrap(async (req, res) => {
    const m = await Member.findOne({ userId: req.user._id });
    if (!m) return res.json([]);
    const latest = new Map();
    for (const p of m.trainingPlans.filter((x) => x.status === "Published")) {
      const cur = latest.get(String(p.planId));
      if (!cur || p.version > cur.version) latest.set(String(p.planId), p);
    }
    res.json([...latest.values()]);
  })
);

// HLV xem các giáo án mình đã soạn cho một hội viên mình phụ trách; Admin xem tất cả
router.get(
  "/member/:memberId",
  requireRole("trainer", "admin"),
  wrap(async (req, res) => {
    const m = await loadMember(req.params.memberId);
    if (req.user.role === "trainer") {
      const t = await myTrainer(req.user);
      await assertAssigned(t._id, m._id);
      return res.json(m.trainingPlans.filter((p) => p.trainerId.equals(t._id)));
    }
    res.json(m.trainingPlans);
  })
);

// Tạo giáo án mới (Draft, version 1)
router.post(
  "/",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const { memberId, ...body } = parse(planBody.extend({ memberId: z.string() }), req.body);
    const t = await myTrainer(req.user);
    const m = await loadMember(memberId);
    await assertAssigned(t._id, m._id);
    m.trainingPlans.push({
      planId: new mongoose.Types.ObjectId(),
      trainerId: t._id,
      version: 1,
      status: "Draft",
      goal: body.goal ?? m.goal,
      weeks: body.weeks,
    });
    await m.save();
    res.status(201).json(m.trainingPlans[m.trainingPlans.length - 1]);
  })
);

function findVersion(m, planId, trainerId, predicate) {
  return m.trainingPlans.find((p) => p.planId.equals(planId) && p.trainerId.equals(trainerId) && predicate(p));
}

// Sửa bản Draft tại chỗ. Bản Published bất biến -> dùng /revise
router.put(
  "/:planId",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const { memberId, ...body } = parse(planBody.extend({ memberId: z.string() }), req.body);
    const t = await myTrainer(req.user);
    const m = await loadMember(memberId);
    await assertAssigned(t._id, m._id);
    const planId = oid(req.params.planId, "planId");
    const draft = findVersion(m, planId, t._id, (p) => p.status === "Draft");
    if (!draft) {
      if (findVersion(m, planId, t._id, () => true)) throw httpError(409, "Bản đã xuất bản không thể sửa. Hãy tạo phiên bản mới (revise).");
      throw httpError(404, "Không tìm thấy giáo án");
    }
    draft.weeks = body.weeks;
    if (body.goal !== undefined) draft.goal = body.goal;
    await m.save();
    res.json(draft);
  })
);

// Tạo phiên bản mới (Draft) từ bản mới nhất; nếu đã có Draft thì trả Draft đó
router.post(
  "/:planId/revise",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const { memberId } = parse(z.object({ memberId: z.string() }), req.body);
    const t = await myTrainer(req.user);
    const m = await loadMember(memberId);
    await assertAssigned(t._id, m._id);
    const planId = oid(req.params.planId, "planId");
    const versions = m.trainingPlans.filter((p) => p.planId.equals(planId) && p.trainerId.equals(t._id));
    if (!versions.length) throw httpError(404, "Không tìm thấy giáo án");
    const existingDraft = versions.find((p) => p.status === "Draft");
    if (existingDraft) return res.json(existingDraft);
    const top = versions.reduce((a, b) => (b.version > a.version ? b : a));
    m.trainingPlans.push({
      planId,
      trainerId: t._id,
      version: top.version + 1,
      status: "Draft",
      goal: top.goal,
      weeks: JSON.parse(JSON.stringify(top.weeks)),
    });
    await m.save();
    res.status(201).json(m.trainingPlans[m.trainingPlans.length - 1]);
  })
);

// Xuất bản: tạo version bất biến; các bản Published cũ chuyển Superseded
router.post(
  "/:planId/publish",
  requireRole("trainer"),
  wrap(async (req, res) => {
    const { memberId } = parse(z.object({ memberId: z.string() }), req.body);
    const t = await myTrainer(req.user);
    const m = await loadMember(memberId);
    await assertAssigned(t._id, m._id);
    const planId = oid(req.params.planId, "planId");
    const draft = findVersion(m, planId, t._id, (p) => p.status === "Draft");
    if (!draft) throw httpError(409, "Không có bản nháp để xuất bản");
    const hasContent = draft.weeks.some((w) => w.days.some((d) => d.exercises.length));
    if (!hasContent) throw httpError(422, "Giáo án chưa có bài tập nào");
    for (const p of m.trainingPlans) {
      if (p.planId.equals(planId) && p.status === "Published") p.status = "Superseded";
    }
    draft.status = "Published";
    draft.publishedAt = new Date();
    await m.save();
    res.json(draft);
  })
);

export default router;
