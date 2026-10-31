import mongoose from "mongoose";

export const PAY_METHODS = ["Thẻ ngân hàng", "Chuyển khoản QR", "Ví điện tử"];

// Thanh toán mô phỏng (SEP không có cổng thanh toán thật): luôn ghi simulated = true
const paymentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // HD00001
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package", required: true },
    packageName: String,
    subscriptionId: mongoose.Schema.Types.ObjectId,
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAY_METHODS, required: true },
    status: { type: String, enum: ["Paid"], default: "Paid" },
    simulated: { type: Boolean, default: true },
    requestId: { type: String, required: true }, // chống bấm thanh toán hai lần
    startDate: Date,
    endDate: Date,
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
paymentSchema.index({ userId: 1, requestId: 1 }, { unique: true });
paymentSchema.index({ memberId: 1, paidAt: -1 });

export default mongoose.model("Payment", paymentSchema);
