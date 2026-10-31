// Các hằng số nghiệp vụ (có thể đổi trong .env)
export const SLOT_MINUTES = 60; // BR.01: slot 60 phút
export const CANCEL_BEFORE_HOURS = 2; // BR.04: hủy trước ít nhất 2 giờ
export const OPEN_HOUR = Number(process.env.OPEN_HOUR ?? 5); // giờ mở cửa (giờ VN)
export const CLOSE_HOUR = Number(process.env.CLOSE_HOUR ?? 22); // giờ đóng cửa (giờ VN)
export const ACTIVE_APPT = ["Pending", "Confirmed", "CheckedIn"]; // lịch đang chiếm chỗ
export const TZ = "Asia/Ho_Chi_Minh";
