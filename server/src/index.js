import "dotenv/config";
import dns from "node:dns";
import express from "express";
import cors from "cors";

// Một số mạng/Windows từ chối truy vấn SRV của mongodb+srv -> dùng DNS công cộng.
// Đặt DNS_SERVERS=off trong .env để tắt, hoặc liệt kê DNS riêng (cách nhau dấu phẩy).
if (process.env.DNS_SERVERS !== "off") {
  dns.setServers((process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim()).filter(Boolean));
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("Thiếu JWT_SECRET (tối thiểu 16 ký tự) trong file .env. Ví dụ: JWT_SECRET=mot-chuoi-dai-ngau-nhien-cua-ban");
  process.exit(1);
}

const { connectDB } = await import("./config/db.js");
const { allModels } = await import("./models/index.js");
const { errorHandler, notFound } = await import("./middleware/error.js");
const { default: authRoutes } = await import("./routes/auth.js");
const { default: userRoutes } = await import("./routes/users.js");
const { default: packageRoutes } = await import("./routes/packages.js");
const { default: trainerRoutes } = await import("./routes/trainers.js");
const { default: scheduleRoutes } = await import("./routes/schedules.js");
const { default: memberRoutes } = await import("./routes/members.js");
const { default: appointmentRoutes } = await import("./routes/appointments.js");
const { default: checkinRoutes } = await import("./routes/checkins.js");
const { default: planRoutes } = await import("./routes/plans.js");
const { default: statsRoutes } = await import("./routes/stats.js");
const { default: notificationRoutes } = await import("./routes/notifications.js");
const { default: messageRoutes } = await import("./routes/messages.js");
const { default: ticketRoutes } = await import("./routes/tickets.js");
const { default: auditRoutes } = await import("./routes/audit.js");
const { default: paymentRoutes } = await import("./routes/payments.js");

const app = express();
app.disable("x-powered-by");
app.use(
  cors({
    origin: (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/trainers", trainerRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/payments", paymentRoutes);
app.use(notFound);
app.use(errorHandler);

await connectDB();
// Tạo collection + index (unique...) trước khi nhận request
await Promise.all(allModels.map((m) => m.init()));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on ${port}`));
