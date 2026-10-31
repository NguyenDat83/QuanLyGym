import mongoose from "mongoose";
const { Schema } = mongoose;

const checkinSchema = new Schema(
  {
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true }, // BR.05
    memberId: { type: Schema.Types.ObjectId, ref: "Member", required: true },
    trainerId: { type: Schema.Types.ObjectId, ref: "Trainer" },
    checkInTime: { type: Date, required: true },
    completedAt: Date,
    status: { type: String, enum: ["CheckedIn", "Completed"], default: "CheckedIn" },
    checkedInBy: { type: Schema.Types.ObjectId, ref: "User" },
    planId: Schema.Types.ObjectId,
    planVersion: Number,
    workoutLog: [
      {
        exerciseName: { type: String, required: true },
        actualSets: Number,
        actualReps: Number,
        loadKg: Number,
        trainerNote: String,
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

checkinSchema.index({ memberId: 1, checkInTime: -1 });
checkinSchema.index({ checkInTime: 1 });

export default mongoose.model("Checkin", checkinSchema);
