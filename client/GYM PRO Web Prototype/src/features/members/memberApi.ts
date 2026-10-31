import { api } from "../../api";
import type { Member } from "../../types";
import { fmtDate, viDateToIso } from "../../lib/format";
import { memberAvatar } from "../../lib/assets";
import { selection } from "../../lib/selection";

export function fromApiMember(m: any): Member {
  return {
    _id: m._id ?? m.id,
    userId: typeof m.userId === "object" ? m.userId?._id : m.userId,
    id: m.code,
    name: m.fullName,
    email: m.email,
    phone: m.phone ?? "",
    birthDate: fmtDate(m.dob),
    gender: m.gender ?? "Nam",
    password: "",
    role: "HỘI VIÊN",
    joined: fmtDate(m.createdAt),
    accountStatus: m.accountStatus ?? "Đang hoạt động",
    plan: m.planName ?? "Chưa đăng ký",
    planStart: m.planStart ? fmtDate(m.planStart) : "—",
    planEnd: m.planEnd ? fmtDate(m.planEnd) : "—",
    planStatus: m.planStatus ?? "Chưa đăng ký",
    goal: m.goal ?? "",
    avatar: memberAvatar,
    checkinsToday: 0,
    upcomingBookings: 0,
    remainingPt: m.remainingPt,
  };
}

export async function persistMemberChange(prev: Member, next: Member): Promise<string | null> {
  try {
    if (next.accountStatus !== prev.accountStatus && next.userId) {
      await api.patch(`/users/${next.userId}`, { isActive: next.accountStatus === "Đang hoạt động", reason: selection.lastLockReason || undefined });
    }
    const changed = (["name", "email", "phone", "gender", "goal", "birthDate"] as const).some((k) => next[k] !== prev[k]);
    if (changed && next._id) {
      const body: Record<string, unknown> = { fullName: next.name, email: next.email, phone: next.phone, gender: next.gender, goal: next.goal };
      const iso = viDateToIso(next.birthDate);
      if (iso) body.dob = iso;
      await api.patch(`/members/${next._id}`, body);
    }
    return null;
  } catch (e: any) {
    return e?.message || "Không lưu được thay đổi";
  }
}
