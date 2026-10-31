// Đổ dữ liệu mẫu khớp giao diện Figma.
//   npm run seed         -> chỉ chạy khi DB còn trống
//   npm run seed:reset   -> XÓA TOÀN BỘ dữ liệu rồi nạp lại
import "dotenv/config";
import dns from "node:dns";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

if (process.env.DNS_SERVERS !== "off") {
  dns.setServers((process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim()).filter(Boolean));
}

const { connectDB } = await import("./config/db.js");
const M = await import("./models/index.js");
const { startOfVnDay, subscriptionEnd, parseVnDate } = await import("./utils/time.js");
const { User, Package, Trainer, Schedule, Member, Appointment, Checkin } = M;

await connectDB();
await Promise.all(M.allModels.map((m) => m.init()));

const reset = process.argv.includes("--reset");
if (!reset && (await User.estimatedDocumentCount()) > 0) {
  console.log("Database đã có dữ liệu. Dùng `npm run seed:reset` nếu muốn xóa và nạp lại.");
  await mongoose.disconnect();
  process.exit(0);
}
if (reset) {
  console.log("Đang xóa dữ liệu cũ trong database:", mongoose.connection.name);
  for (const m of M.allModels) await m.deleteMany({});
}

const hash = (p) => bcrypt.hash(p, 10);
const DAY = 86400000;
const today = startOfVnDay(new Date());
const at = (dayOffset, hour) => new Date(today.getTime() + dayOffset * DAY + hour * 3600000);
const vn = (s) => parseVnDate(s); // "YYYY-MM-DD"

// ---------- Gói tập
const pk = {};
for (const p of [
  { code: "BASIC", name: "Basic", description: "Tập không giới hạn, theo dõi tiến độ", config: { price: 399000, durationDays: 30, ptSessions: 1, isActive: true } },
  { code: "PREMIUM", name: "Premium", description: "Mọi quyền lợi Basic, 4 buổi PT/tháng, kế hoạch cá nhân", config: { price: 799000, durationDays: 30, ptSessions: 4, isActive: true } },
  { code: "VIP", name: "VIP", description: "Mọi quyền lợi Premium, PT không giới hạn, ưu tiên đặt lịch", config: { price: 1299000, durationDays: 30, ptSessions: 30, isActive: true } },
]) pk[p.code] = await Package.create(p);

// ---------- Tài khoản nhân sự
const admin = await User.create({ email: "admin@gympro.vn", fullName: "Lê Thu Hà", phone: "0900000001", role: "admin", passwordHash: await hash("Admin@123") });

// ---------- HLV (theo màn hình Figma)
const allPk = [pk.BASIC._id, pk.PREMIUM._id, pk.VIP._id];
const trainerSeed = [
  { code: "PT001", certificate: "NASM-CPT", fullName: "Nguyễn Minh Hoàng", email: "hoang.nguyen@gympro.vn", expertise: "Tăng cơ & Sức mạnh", experienceYears: 8, packageIds: allPk, bio: "Tôi tin rằng mỗi người đều có một tiềm năng riêng. Lộ trình được cá nhân hóa đúng cách sẽ giúp bạn đạt mục tiêu nhanh hơn, an toàn hơn." },
  { code: "PT002", certificate: "ACE-CPT", fullName: "Trần Ngọc Anh", email: "ngocanh.tran@gympro.vn", expertise: "Giảm cân & Cardio", experienceYears: 6, packageIds: allPk, bio: "Chuyên xây dựng lộ trình giảm mỡ bền vững, an toàn." },
  { code: "PT003", certificate: "ISSA", fullName: "Lê Quốc Bảo", email: "bao.le@gympro.vn", expertise: "Thể hình chuyên nghiệp", experienceYears: 10, packageIds: [pk.PREMIUM._id, pk.VIP._id], bio: "Huấn luyện thể hình chuyên nghiệp, thi đấu và chuyển đổi thể hình." },
];
const T = [];
for (const t of trainerSeed) {
  const u = await User.create({ email: t.email, fullName: t.fullName, role: "trainer", passwordHash: await hash("Trainer@123") });
  T.push(await Trainer.create({ ...t, userId: u._id, packageId: t.packageIds[0] }));
}
const [hoang, ngocanh, bao] = T;

// ---------- Hội viên (theo Figma). Mật khẩu: Member@123
const memberSeed = [
  { code: "HV00121", name: "Vũ Minh Trang", email: "trang.vu@gympro.vn", phone: "097 355 9018", dob: "1999-01-28", gender: "Nữ", joined: "2026-09-28", locked: false, goal: "Duy trì vóc dáng", sub: { pk: "BASIC", start: "2026-09-28", end: "2026-10-28", total: 1, price: 399000 } },
  { code: "HV00122", name: "Lê Hoàng Nam", email: "nam.le@gympro.vn", phone: "093 778 1102", dob: "1997-06-17", gender: "Nam", joined: "2026-10-03", locked: true, goal: "Tăng sức bền", sub: { pk: "PREMIUM", start: "2026-09-01", end: "2026-09-30", total: 4, price: 799000 } },
  { code: "HV00123", name: "Phạm Quốc Anh", email: "anh.pham@gympro.vn", phone: "098 611 2034", dob: "1995-11-05", gender: "Nam", joined: "2026-10-07", locked: false, goal: "Tập luyện chuyên nghiệp", sub: { pk: "VIP", start: "2026-10-07", end: "2027-01-07", total: 90, price: 1299000 * 3 } },
  { code: "HV00124", name: "Trần Thị Ngọc", email: "ngoc.tran@gympro.vn", phone: "091 238 4421", dob: "2000-03-20", gender: "Nữ", joined: "2026-10-09", locked: false, goal: "Giảm cân", sub: { pk: "BASIC", start: "2026-10-09", end: "2026-11-09", total: 1, price: 399000 } },
  { code: "HV00125", name: "Nguyễn Văn Minh", email: "minh.nguyen@gympro.vn", phone: "090 456 7682", dob: "1998-08-12", gender: "Nam", joined: "2026-10-10", locked: false, goal: "Tăng cơ và cải thiện sức bền", sub: { pk: "PREMIUM", start: "2026-10-01", end: "2026-12-31", total: 12, price: 799000 * 3 } },
];
const MB = {};
for (const s of memberSeed) {
  const u = await User.create({ email: s.email, fullName: s.name, phone: s.phone, role: "member", isActive: !s.locked, passwordHash: await hash("Member@123"), createdAt: vn(s.joined) });
  const pkg = pk[s.sub.pk];
  MB[s.code] = await Member.create({
    userId: u._id, code: s.code, fullName: s.name, email: s.email, phone: s.phone, dob: vn(s.dob), gender: s.gender, goal: s.goal, experienceLevel: "Trung bình",
    createdAt: vn(s.joined),
    subscriptions: [{ packageId: pkg._id, packageCode: pkg.code, packageName: pkg.name, priceSnapshot: s.sub.price, startDate: vn(s.sub.start), endDate: subscriptionEnd(vn(s.sub.end), 1), totalPt: s.sub.total, usedPt: 0, status: "Active", createdBy: admin._id }],
  });
}

// ---------- Lịch làm việc 14 ngày tới: 7-11h và 15-20h mỗi HLV
const slotHours = [7, 8, 9, 10, 11, 15, 16, 17, 18, 19, 20];
const mkSlot = async (trainer, dayOffset, hour) => {
  const startAt = at(dayOffset, hour);
  return Schedule.findOneAndUpdate(
    { trainerId: trainer._id, startAt },
    { $setOnInsert: { trainerId: trainer._id, startAt, endAt: new Date(startAt.getTime() + 3600000), maxSlots: 1, bookedSlots: 0, isOpen: true } },
    { upsert: true, returnDocument: "after" }
  );
};
for (const t of T) for (let d = 1; d <= 14; d++) for (const h of slotHours) await mkSlot(t, d, h);

// ---------- Lịch hẹn mẫu (gồm quá khứ để có số liệu thống kê)
let n = 0;
const book = async (code, trainer, dayOffset, hour, status, extra = {}) => {
  const mem = MB[code];
  const sch = await mkSlot(trainer, dayOffset, hour);
  const active = status !== "Cancelled";
  if (active) await Schedule.updateOne({ _id: sch._id }, { $set: { bookedSlots: 1 } });
  const sub = mem.subscriptions[0];
  const a = await Appointment.create({
    memberId: mem._id, trainerId: trainer._id, scheduleId: sch._id, subscriptionId: sub._id,
    startAt: sch.startAt, endAt: sch.endAt, status, requestId: `seed-${++n}`, refunded: status === "Cancelled" ? true : undefined,
    cancelledAt: status === "Cancelled" ? new Date() : undefined, cancelReason: status === "Cancelled" ? "Thay đổi lịch cá nhân" : undefined, ...extra,
  });
  if (active) await Member.updateOne({ _id: mem._id }, { $inc: { "subscriptions.0.usedPt": 1 } });
  if (status === "Completed") {
    await Checkin.create({
      appointmentId: a._id, memberId: mem._id, trainerId: trainer._id, checkInTime: new Date(sch.startAt.getTime() - 5 * 60000), completedAt: sch.endAt, status: "Completed",
      workoutLog: [{ exerciseName: "Bench Press", actualSets: 3, actualReps: 12, loadKg: 40, trainerNote: "Giữ form tốt" }, { exerciseName: "Incline Dumbbell Press", actualSets: 3, actualReps: 10, loadKg: 16 }],
    });
  }
  return a;
};
await book("HV00125", hoang, -6, 17, "Completed");
await book("HV00125", hoang, -4, 17, "Completed");
await book("HV00125", hoang, -2, 8, "Completed");
await book("HV00125", hoang, 0, 18, "Confirmed"); // lịch hôm nay: dùng để demo check-in
await book("HV00125", hoang, 2, 17, "Confirmed");
await book("HV00124", ngocanh, -3, 9, "Completed");
await book("HV00123", bao, -5, 19, "Completed");
await book("HV00123", bao, -2, 7 + 0, "Cancelled");
await book("HV00123", bao, -1, 19, "NoShow");
await book("HV00123", bao, 1, 19, "Confirmed");
await book("HV00123", bao, 3, 19, "Confirmed");
await book("HV00121", hoang, 4, 10, "Confirmed");
await book("HV00123", hoang, 2, 10, "Pending"); // yêu cầu đang chờ HLV duyệt (demo)
await book("HV00124", hoang, 3, 15, "Pending");

// ---------- Giáo án đã xuất bản: HLV Hoàng -> Minh
const planId = new mongoose.Types.ObjectId();
await Member.updateOne(
  { _id: MB.HV00125._id },
  {
    $push: {
      trainingPlans: {
        planId, trainerId: hoang._id, version: 1, status: "Published", goal: "Tăng cơ và cải thiện sức bền", publishedAt: new Date(),
        weeks: [{ week: 4, days: [
          { day: "Thứ Hai", title: "Ngực & Tay sau", exercises: [
            { name: "Bench Press", sets: 3, reps: 12, restSeconds: 90 }, { name: "Incline Dumbbell Press", sets: 3, reps: 10, restSeconds: 90 },
            { name: "Cable Fly", sets: 3, reps: 12, restSeconds: 60 }, { name: "Tricep Pushdown", sets: 3, reps: 12, restSeconds: 60 }, { name: "Dips", sets: 3, reps: 10, restSeconds: 90 } ] },
          { day: "Thứ Tư", title: "Lưng & Tay trước", exercises: [
            { name: "Lat Pulldown", sets: 3, reps: 12, restSeconds: 90 }, { name: "Seated Row", sets: 3, reps: 12, restSeconds: 90 }, { name: "Barbell Curl", sets: 3, reps: 10, restSeconds: 60 } ] },
          { day: "Thứ Sáu", title: "Chân", exercises: [
            { name: "Squat", sets: 4, reps: 10, restSeconds: 120 }, { name: "Leg Press", sets: 3, reps: 12, restSeconds: 90 }, { name: "Romanian Deadlift", sets: 3, reps: 10, restSeconds: 90 } ] },
        ] }],
      },
    },
  }
);

// ---------- Tin nhắn, hỗ trợ, thông báo mẫu
{
  const { Conversation, Message, Ticket, Notification, AuditLog } = M;
  const uid = (x) => x.userId;
  const key = (a, b) => [String(a), String(b)].sort().join(":");
  const minh = MB.HV00125;
  const mkConv = async (a, b, msgs) => {
    const c = await Conversation.create({ key: key(a, b), participants: [a, b] });
    let last;
    for (const [from, body, mins, readByOther] of msgs) {
      const createdAt = new Date(Date.now() - mins * 60000);
      last = await Message.create({ conversationId: c._id, senderId: from, body, readBy: readByOther ? [a, b] : [from], createdAt });
    }
    await Conversation.updateOne({ _id: c._id }, { $set: { lastMessageAt: last.createdAt, lastMessageText: last.body, lastSenderId: last.senderId } });
  };
  await mkConv(uid(minh), uid(hoang), [
    [uid(minh), "Anh xem giúp em lịch tập sức mạnh chiều thứ Tư nhé.", 120, true],
    [uid(hoang), "Anh đã xem. Em đến sớm 10 phút để khởi động nhé.", 110, false],
  ]);
  await mkConv(admin._id, uid(minh), [[admin._id, "GYM PRO đã cập nhật quyền lợi gói Premium của bạn.", 1500, true]]);
  await mkConv(uid(hoang), admin._id, [[uid(hoang), "Nhờ Admin hỗ trợ kiểm tra xung đột lịch chiều thứ Sáu.", 3000, false]]);

  await Ticket.create({ code: "YC00001", senderId: uid(minh), title: "Không đổi được lịch tập", category: "Lịch tập", priority: "Cao", content: "Tôi muốn đổi buổi tập sang ngày khác nhưng khung giờ đang báo bận.", status: "Đang xử lý", assigneeId: admin._id,
    replies: [{ senderId: admin._id, body: "GYM PRO đã tiếp nhận và đang kiểm tra lịch với HLV." }] });
  await Ticket.create({ code: "YC00002", senderId: uid(hoang), title: "Xung đột lịch làm việc", category: "Lịch tập", priority: "Trung bình", content: "Hai lịch PT đang trùng lúc 18:00 thứ Sáu, nhờ Admin hỗ trợ điều phối.", status: "Mới", assigneeId: admin._id });

  await Notification.insertMany([
    { userId: uid(minh), icon: "calendar", title: "Lịch đã được xác nhận", body: "Buổi tập hôm nay lúc 18:00 đã được xác nhận.", target: "schedule" },
    { userId: uid(minh), icon: "message", title: "Tin nhắn mới", body: "Nguyễn Minh Hoàng: Anh đã xem. Em đến sớm 10 phút để khởi động nhé.", target: "messages" },
    { userId: uid(hoang), icon: "calendar", title: "Lịch mới chờ xác nhận", body: "Có yêu cầu đặt lịch đang chờ bạn duyệt.", target: "trainer-dashboard" },
    { userId: admin._id, icon: "help", title: "Yêu cầu hỗ trợ mới", body: "YC00002: Xung đột lịch làm việc", target: "support" },
  ]);
  await AuditLog.insertMany([
    { actorId: admin._id, action: "user.unlock", targetType: "User", targetId: MB.HV00122.userId, detail: { reason: "Đã xác minh" }, at: new Date(Date.now() - 3600000) },
    { actorId: uid(hoang), action: "ticket.create", targetType: "Ticket", targetId: new mongoose.Types.ObjectId(), detail: { code: "YC00002" }, at: new Date(Date.now() - 7200000) },
  ]);
}

console.log("\nĐã nạp dữ liệu mẫu. Tài khoản đăng nhập:");
console.log("  Admin     admin@gympro.vn          Admin@123");
console.log("  HLV       hoang.nguyen@gympro.vn   Trainer@123   (ngocanh.tran@..., bao.le@... cùng mật khẩu)");
console.log("  Hội viên  minh.nguyen@gympro.vn    Member@123    (ngoc.tran, anh.pham, trang.vu cùng mật khẩu; nam.le đang bị khóa)");
await mongoose.disconnect();
