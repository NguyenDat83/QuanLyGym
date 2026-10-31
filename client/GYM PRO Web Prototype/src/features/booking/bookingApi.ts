import type { BookingRecord } from "../../types";
import { vnDateKey, vnTime, vnWeekday } from "../../lib/format";

export const APPT_TO_RECORD: Record<string, BookingRecord["status"]> = {
  Pending: "Chờ xác nhận",
  Confirmed: "Đã xác nhận",
  Rejected: "Bị từ chối",
  Cancelled: "Đã hủy",
  CheckedIn: "Đã check-in",
  Completed: "Đã hoàn thành",
  NoShow: "Không đến",
};

export function fromApiAppt(a: any): BookingRecord {
  const key = vnDateKey(a.startAt);
  return {
    id: a._id,
    dateKey: key,
    memberId: a.memberId?.code ?? "",
    memberName: a.memberId?.fullName ?? "Hội viên",
    trainerId: a.trainerId?.code ?? "",
    trainerName: a.trainerId?.fullName ?? "",
    type: a.note || "Tập luyện cá nhân",
    day: `${vnWeekday(key)} ${key.slice(8, 10)}`,
    time: vnTime(a.startAt),
    status: APPT_TO_RECORD[a.status] ?? "Đã hủy",
    note: a.cancelReason ? `Lý do: ${a.cancelReason}` : "",
  };
}
