// Trạng thái chọn dùng chung giữa các trang (không cần React state, mất khi tải lại trang).
export const selection = {
  lastLockReason: "" as string, // lý do khóa vừa nhập ở hộp thoại, gửi kèm khi lưu lên server
  selectedTrainerId: null as string | null, // HLV đang xem hồ sơ
  bookingPresetTrainer: null as string | null, // HLV chọn sẵn khi bấm "Đặt lịch" ở danh sách
  selectedPlanDay: null as string | null, // ngày tập đang xem trong giáo án
};
