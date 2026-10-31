export type Page =
  | "login" | "register" | "dashboard" | "schedule" | "booking" | "trainers"
  | "trainer-detail" | "plans" | "workout" | "progress" | "membership"
  | "notifications" | "profile" | "success" | "checkin" | "checkin-history"
  | "checkin-duplicates" | "checkin-report" | "checkin-rules" | "admin-dashboard"
  | "members" | "member-detail" | "my-checkins" | "trainer-dashboard"
  | "trainer-management" | "trainer-schedule" | "assigned-members"
  | "messages" | "support" | "activity";

export type Role = "ADMIN" | "HỘI VIÊN" | "HLV";

export type AccountStatus = "Đang hoạt động" | "Đã khóa";

export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: string;
  password: string;
  role: "HỘI VIÊN";
  joined: string;
  accountStatus: AccountStatus;
  plan: string;
  planStart: string;
  planEnd: string;
  planStatus: "Còn hiệu lực" | "Hết hạn" | "Chưa đăng ký";
  goal: string;
  avatar: string;
  checkinsToday: number;
  upcomingBookings: number;
  remainingPt?: number; // số buổi PT còn lại
  _id?: string; // id hồ sơ hội viên trong MongoDB
  userId?: string; // id tài khoản trong MongoDB
};

export type BookingDetails = {
  type: string;
  day: string;
  time: string;
  trainer: string;
  dateText?: string;
  code?: string;
};

export type Trainer = { _id?:string; id:string; name:string; email:string; phone:string; password:string; specialty:string; experience:string; certificate:string; status:"Đang hoạt động"|"Đã khóa"; members:number; avatar:string };

export type BookingRecord = { dateKey?:string; id:string; memberId:string; memberName:string; trainerId:string; trainerName:string; type:string; day:string; time:string; status:"Không đến"|"Chờ xác nhận"|"Đã xác nhận"|"Đã check-in"|"Bị từ chối"|"Đã hủy"|"Đã hoàn thành"; note:string };







export type ApiAppt = {
  _id: string;
  startAt: string;
  endAt: string;
  status: string;
  note?: string;
  refunded?: boolean;
  trainerId?: { _id: string; fullName: string; code?: string } | null;
};
