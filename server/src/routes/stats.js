import { Router } from "express";
import { Appointment, Checkin, Member, User } from "../models/index.js";
import { auth, requireRole } from "../middleware/auth.js";
import { httpError, wrap } from "../utils/http.js";
import { TZ } from "../utils/config.js";
import { endOfVnDay, parseVnDate, startOfVnDay, addDays } from "../utils/time.js";

const router = Router();
router.use(auth, requireRole("admin"));

// Khoảng thời gian: ?from=YYYY-MM-DD&to=YYYY-MM-DD (giờ VN). Mặc định 7 ngày gần nhất.
function range(req) {
  const now = new Date();
  const to = req.query.to ? parseVnDate(String(req.query.to)) : startOfVnDay(now);
  const from = req.query.from ? parseVnDate(String(req.query.from)) : addDays(to, -6);
  if (!to || !from) throw httpError(400, "from/to phải có dạng YYYY-MM-DD");
  if (from > to) throw httpError(400, "from phải ≤ to");
  if ((to - from) / 86400000 > 366) throw httpError(400, "Khoảng thời gian tối đa 366 ngày");
  return { from, to: endOfVnDay(to) };
}

// Tổng quan cho trang Admin
router.get(
  "/overview",
  wrap(async (_req, res) => {
    const now = new Date();
    const dayStart = startOfVnDay(now);
    const weekAgo = addDays(dayStart, -6);
    const memberUsers = await User.find({ role: "member", deletedAt: null }).select("isActive");
    const [checkinsToday, upcoming, newThisWeek] = await Promise.all([
      Checkin.countDocuments({ checkInTime: { $gte: dayStart, $lte: endOfVnDay(now) } }),
      Appointment.countDocuments({ status: "Confirmed", startAt: { $gt: now } }),
      Member.countDocuments({ createdAt: { $gte: weekAgo } }),
    ]);
    res.json({
      totalMembers: memberUsers.length,
      activeMembers: memberUsers.filter((u) => u.isActive).length,
      lockedMembers: memberUsers.filter((u) => !u.isActive).length,
      newMembersThisWeek: newThisWeek,
      checkinsToday,
      upcomingAppointments: upcoming,
    });
  })
);

// F.6.1 Lượt check-in duy nhất theo ngày/tuần; phân biệt với số hội viên duy nhất (BR.10)
router.get(
  "/checkins",
  wrap(async (req, res) => {
    const { from, to } = range(req);
    const unit = req.query.unit === "week" ? "week" : "day";
    const rows = await Checkin.aggregate([
      { $match: { checkInTime: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: { $dateTrunc: { date: "$checkInTime", unit, startOfWeek: "monday", timezone: TZ } }, timezone: TZ } },
          checkins: { $sum: 1 }, // mỗi bản ghi check-in là duy nhất theo appointmentId
          members: { $addToSet: "$memberId" },
        },
      },
      { $project: { _id: 0, period: "$_id", checkins: 1, uniqueMembers: { $size: "$members" } } },
      { $sort: { period: 1 } },
    ]);
    res.json({ unit, from, to, items: rows, totalCheckins: rows.reduce((s, r) => s + r.checkins, 0) });
  })
);

// F.6.2 Thống kê theo HLV: chỉ tính buổi Completed và giờ PT thực hiện
router.get(
  "/trainers",
  wrap(async (req, res) => {
    const { from, to } = range(req);
    const rows = await Appointment.aggregate([
      { $match: { status: "Completed", startAt: { $gte: from, $lte: to } } },
      { $group: { _id: "$trainerId", sessions: { $sum: 1 }, hours: { $sum: { $divide: [{ $subtract: ["$endAt", "$startAt"] }, 3600000] } }, members: { $addToSet: "$memberId" } } },
      { $lookup: { from: "trainers", localField: "_id", foreignField: "_id", as: "t" } },
      { $unwind: { path: "$t", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, trainerId: "$_id", code: "$t.code", fullName: "$t.fullName", sessions: 1, hours: { $round: ["$hours", 2] }, uniqueMembers: { $size: "$members" } } },
      { $sort: { sessions: -1 } },
    ]);
    res.json({ from, to, items: rows });
  })
);

// F.6.3 Hủy / không đến: đếm riêng; mẫu số = tổng lịch đã đến hạn trong kỳ (startAt ≤ hiện tại)
router.get(
  "/cancellations",
  wrap(async (req, res) => {
    const { from, to } = range(req);
    const now = new Date();
    const upper = to < now ? to : now;
    const rows = await Appointment.aggregate([
      { $match: { startAt: { $gte: from, $lte: upper } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    const c = Object.fromEntries(rows.map((r) => [r._id, r.n]));
    const due = rows.reduce((s, r) => s + r.n, 0);
    const rate = (n) => (due ? Math.round((n / due) * 10000) / 100 : 0);
    res.json({
      from,
      to,
      dueAppointments: due,
      cancelled: c.Cancelled || 0,
      noShow: c.NoShow || 0,
      completed: c.Completed || 0,
      cancelRate: rate(c.Cancelled || 0),
      noShowRate: rate(c.NoShow || 0),
    });
  })
);

export default router;
