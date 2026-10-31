// lý do khóa vừa nhập ở hộp thoại, gửi kèm khi lưu lên server
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" }) : "");

export const viDateToIso = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// ===== Tiện ích hiển thị dữ liệu thật từ API =====
export const VN_TZ = "Asia/Ho_Chi_Minh";

export const vnDateKey = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: VN_TZ });

export const vnTime = (d: string | Date) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: VN_TZ });

export const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export const vnWeekday = (key: string) => WEEKDAYS[new Date(key + "T00:00:00Z").getUTCDay()];

export const addKeyDays = (key: string, n: number) => {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const keyToVi = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

export const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";
