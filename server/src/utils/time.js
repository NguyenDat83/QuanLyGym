// Giờ lưu UTC, hiển thị/tính ngày theo Asia/Ho_Chi_Minh (UTC+7, không có DST) - BR.02
const H = 3600000;
const VN = 7 * H;
const DAY = 24 * H;

export const startOfVnDay = (d) => new Date(Math.floor((new Date(d).getTime() + VN) / DAY) * DAY - VN);
export const endOfVnDay = (d) => new Date(startOfVnDay(d).getTime() + DAY - 1);
export const vnHour = (d) => new Date(new Date(d).getTime() + VN).getUTCHours();
export const vnMinutes = (d) => {
  const t = new Date(new Date(d).getTime() + VN);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};
export const vnDayKey = (d) => new Date(new Date(d).getTime() + VN).toISOString().slice(0, 10);

// "YYYY-MM-DD" -> 00:00 giờ VN của ngày đó (dạng UTC Date)
export function parseVnDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00.000Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t - VN);
}
export const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);
export const addMinutes = (d, n) => new Date(new Date(d).getTime() + n * 60000);

// BR.07: ngày hết hạn = ngày bắt đầu + durationDays - 1 (tính hết ngày đó)
export const subscriptionEnd = (startDate, durationDays) =>
  new Date(startOfVnDay(startDate).getTime() + durationDays * DAY - 1);
