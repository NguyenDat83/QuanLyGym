import type { Member, Trainer } from "../../types";
import { memberAvatar, photoOf } from "../../lib/assets";

// ===== Dữ liệu HLV từ API =====
export function fromApiTrainer(t: any): Trainer {
  return {
    _id: t._id,
    id: t.code,
    name: t.fullName,
    email: t.email ?? "",
    phone: t.phone ?? "",
    password: "",
    specialty: t.expertise ?? "",
    experience: t.experienceYears != null ? `${t.experienceYears} năm` : "—",
    certificate: t.certificate ?? "—",
    status: t.isActive === false ? "Đã khóa" : "Đang hoạt động",
    members: 0,
    avatar: photoOf(t._id),
  };
}

export function fromApiAssigned(m: any): Member {
  return {
    _id: m._id, id: m.code, name: m.fullName, email: "", phone: "", birthDate: "", gender: "", password: "", role: "HỘI VIÊN",
    joined: "", accountStatus: "Đang hoạt động", plan: m.planName ?? "Chưa đăng ký", planStart: "", planEnd: "", planStatus: m.planStatus ?? "Chưa đăng ký",
    goal: m.goal || "Chưa cập nhật", avatar: memberAvatar, checkinsToday: 0, upcomingBookings: 0, remainingPt: m.remainingPt,
  };
}
