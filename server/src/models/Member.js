import mongoose from "mongoose";
const { Schema } = mongoose;

// Gói đã mua: lưu snapshot giá/quota tại thời điểm mua (BR.07)
const subscriptionSchema = new Schema({
  packageId: { type: Schema.Types.ObjectId, ref: "Package", required: true },
  packageCode: String,
  packageName: String,
  priceSnapshot: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalPt: { type: Number, required: true, min: 0 },
  usedPt: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["Active", "Cancelled"], default: "Active" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const exerciseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sets: { type: Number, required: true, min: 1, validate: Number.isInteger },
    reps: { type: Number, required: true, min: 1, validate: Number.isInteger },
    restSeconds: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  { _id: false }
);

const daySchema = new Schema(
  { day: { type: String, required: true }, title: String, exercises: [exerciseSchema] },
  { _id: false }
);

const trainingPlanSchema = new Schema({
  planId: { type: Schema.Types.ObjectId, required: true },
  trainerId: { type: Schema.Types.ObjectId, ref: "Trainer", required: true },
  version: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["Draft", "Published", "Superseded"], default: "Draft" },
  goal: String,
  weeks: [{ week: { type: Number, required: true }, days: [daySchema], _id: false }],
  createdAt: { type: Date, default: Date.now },
  publishedAt: Date,
});

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    code: { type: String, required: true, unique: true }, // HV00001
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    dob: Date,
    gender: String,
    address: String,
    goal: String,
    experienceLevel: String,
    subscriptions: [subscriptionSchema],
    trainingPlans: [trainingPlanSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);
