import { Notification, Member, Trainer, User } from "../models/index.js";

// Tạo thông báo; lỗi không làm hỏng thao tác chính.
export async function notify(userIds, { icon = "bell", title, body = "", target = "notifications" }) {
  try {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map((userId) => ({ userId, icon, title, body, target })));
  } catch (e) {
    console.error("notify error:", e.message);
  }
}

export async function adminIds() {
  return (await User.find({ role: "admin", isActive: true, deletedAt: null }).select("_id")).map((u) => u._id);
}

const idOf = (x) => (x && x._id ? x._id : x);

// Lấy userId của hội viên và HLV từ một lịch hẹn (đã populate hoặc chưa)
export async function apptUsers(appt) {
  const [m, t] = await Promise.all([
    Member.findById(idOf(appt.memberId)).select("userId fullName"),
    Trainer.findById(idOf(appt.trainerId)).select("userId fullName"),
  ]);
  return { memberUserId: m?.userId, trainerUserId: t?.userId, memberName: m?.fullName ?? "Hội viên", trainerName: t?.fullName ?? "HLV" };
}

const fmt = (d) => {
  const v = new Date(new Date(d).getTime() + 7 * 3600000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(v.getUTCHours())}:${p(v.getUTCMinutes())} ngày ${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}`;
};
export const apptWhen = fmt;
