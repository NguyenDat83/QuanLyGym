import { Member } from "../models/index.js";

// Sinh mã hội viên HV00001, HV00002...
export async function nextMemberCode() {
  const last = await Member.findOne().sort({ code: -1 }).select("code").lean();
  const n = last ? parseInt(last.code.replace(/\D/g, ""), 10) + 1 : 1;
  return "HV" + String(n).padStart(5, "0");
}

// Tạo hồ sơ hội viên (thử lại nếu trùng mã do tạo đồng thời)
export async function createMemberProfile(data) {
  for (let i = 0; i < 5; i++) {
    try {
      return await Member.create({ ...data, code: await nextMemberCode() });
    } catch (e) {
      if (e.code === 11000 && e.keyPattern?.code) continue;
      throw e;
    }
  }
  throw new Error("Không tạo được mã hội viên");
}

export function subscriptionState(sub, now = new Date()) {
  if (sub.status !== "Active") return "Đã hủy";
  if (now < sub.startDate) return "Chưa bắt đầu";
  if (now > sub.endDate) return "Hết hạn";
  return "Còn hiệu lực";
}

// Gói còn hiệu lực + còn buổi PT, hỗ trợ bởi HLV (BR.03)
export function pickSubscription(member, trainer, at, subscriptionId) {
  const supported = new Set([...(trainer.packageIds || []), trainer.packageId].filter(Boolean).map(String));
  const ok = member.subscriptions
    .filter((s) => !subscriptionId || s._id.equals(subscriptionId))
    .filter(
      (s) =>
        s.status === "Active" &&
        s.startDate <= at &&
        s.endDate >= at &&
        s.usedPt < s.totalPt &&
        supported.has(String(s.packageId))
    )
    .sort((a, b) => a.endDate - b.endDate);
  return ok[0] || null;
}

// Dữ liệu hội viên kèm thông tin gói hiện tại (khớp màn hình Figma)
export function summarizeMember(m, now = new Date()) {
  const o = m.toObject ? m.toObject() : m;
  const subs = (o.subscriptions || []).map((s) => ({
    ...s,
    id: s._id,
    remainingPt: s.totalPt - s.usedPt,
    state: subscriptionState(s, now),
  }));
  const valid = subs.filter((s) => s.state === "Còn hiệu lực").sort((a, b) => b.endDate - a.endDate)[0];
  const latest = [...subs].sort((a, b) => b.endDate - a.endDate)[0];
  const cur = valid || latest;
  const { trainingPlans, ...rest } = o;
  return {
    ...rest,
    id: o._id,
    subscriptions: subs,
    planName: cur?.packageName ?? null,
    planStart: cur?.startDate ?? null,
    planEnd: cur?.endDate ?? null,
    planStatus: cur ? (valid ? "Còn hiệu lực" : "Hết hạn") : "Chưa đăng ký",
    remainingPt: valid ? valid.remainingPt : 0,
  };
}
