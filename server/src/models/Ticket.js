import mongoose from "mongoose";

export const TICKET_STATUS = ["Mới", "Đã tiếp nhận", "Đang xử lý", "Chờ phản hồi", "Đã giải quyết", "Đã đóng"];
export const TICKET_CATEGORY = ["Tài khoản", "Lịch tập", "HLV", "Gói hội viên", "Check-in", "Lỗi hệ thống", "Khiếu nại", "Khác"];
export const TICKET_PRIORITY = ["Thấp", "Trung bình", "Cao"];

const replySchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const ticketSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // YC00001
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    category: { type: String, enum: TICKET_CATEGORY, default: "Khác" },
    priority: { type: String, enum: TICKET_PRIORITY, default: "Trung bình" },
    content: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: TICKET_STATUS, default: "Mới" },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    internalNote: { type: String, default: "", maxlength: 2000 }, // chỉ Admin thấy
    replies: [replySchema],
  },
  { timestamps: true }
);
ticketSchema.index({ senderId: 1, updatedAt: -1 });
ticketSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model("Ticket", ticketSchema);
