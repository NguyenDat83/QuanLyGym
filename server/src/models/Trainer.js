import mongoose from "mongoose";

const trainerSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package" }, // gói chuyên trách
    packageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Package" }], // các gói được phục vụ
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    expertise: { type: String, trim: true },
    bio: { type: String, trim: true },
    certificate: { type: String, trim: true },
    experienceYears: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// userId duy nhất khi có giá trị
trainerSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });
trainerSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });

export default mongoose.model("Trainer", trainerSchema);
