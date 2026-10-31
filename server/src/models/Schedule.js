import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "Trainer", required: true },
    startAt: { type: Date, required: true }, // UTC
    endAt: { type: Date, required: true },
    maxSlots: { type: Number, default: 1 },
    bookedSlots: { type: Number, default: 0, min: 0, max: 1 }, // chỉ 0 hoặc 1
    isOpen: { type: Boolean, default: true }, // false = ngừng nhận lịch mới
  },
  { timestamps: true }
);

scheduleSchema.index({ trainerId: 1, startAt: 1 }, { unique: true });
scheduleSchema.pre("validate", function () {
  if (this.endAt <= this.startAt) throw new Error("endAt phải lớn hơn startAt");
});

export default mongoose.model("Schedule", scheduleSchema);
