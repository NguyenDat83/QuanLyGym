import mongoose from "mongoose";
const { Schema } = mongoose;

const appointmentSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: "Trainer", required: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: "Schedule", required: true },
    subscriptionId: { type: Schema.Types.ObjectId, required: true }, // phần tử trong members.subscriptions
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "CheckedIn", "Completed", "Cancelled", "Rejected", "NoShow"],
      default: "Confirmed",
    },
    requestId: { type: String, required: true, unique: true }, // chống gửi lặp
    note: String,
    cancelledAt: Date,
    cancelReason: String,
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    refunded: Boolean,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

appointmentSchema.index({ memberId: 1, startAt: 1, status: 1 });
appointmentSchema.index({ trainerId: 1, startAt: 1, status: 1 });

export default mongoose.model("Appointment", appointmentSchema);
