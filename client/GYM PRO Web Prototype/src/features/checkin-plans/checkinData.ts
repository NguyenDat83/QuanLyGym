export type CheckinStage = "idle" | "scanning" | "verifying" | "eligible" | "processing" | "success" | "duplicate" | "expired" | "locked" | "invalid" | "device";

export type DemoCase = "valid" | "duplicate" | "expired" | "locked" | "invalid" | "device";

export const checkinRows = [
  ["CI20261010001","HV00125","Nguyễn Văn Minh","10/10/2026","08:15","QR","Lê Thu Hà","Thành công"],
  ["CI20261010002","HV00842","Trần Thị Ngọc","10/10/2026","08:32","Thủ công","Lê Thu Hà","Thành công"],
  ["CI20261010003","HV00316","Phạm Quốc Anh","10/10/2026","09:05","QR","Hệ thống","Thành công"],
  ["—","HV00629","Lê Hoàng Nam","10/10/2026","09:18","QR","Hệ thống","Từ chối"],
  ["CI20261009087","HV00451","Vũ Minh Trang","09/10/2026","18:42","Thủ công","Nguyễn Huy","Thành công"],
  ["CI20261009086","HV00125","Nguyễn Văn Minh","09/10/2026","17:10","QR","Hệ thống","Thành công"],
];
