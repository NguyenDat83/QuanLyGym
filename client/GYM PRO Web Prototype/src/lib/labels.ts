export const APPT_LABEL: Record<string, [string, string]> = {
  Pending: ["Chờ HLV xác nhận", "bg-orange-50 text-orange-600"],
  Rejected: ["HLV từ chối", "bg-red-50 text-red-600"],
  Confirmed: ["Đã xác nhận", "bg-blue-50 text-blue-600"],
  CheckedIn: ["Đã check-in", "bg-green-50 text-green-600"],
  Completed: ["Hoàn thành", "bg-green-50 text-green-600"],
  Cancelled: ["Đã hủy", "bg-red-50 text-red-600"],
  NoShow: ["Không đến", "bg-orange-50 text-orange-600"],
};
