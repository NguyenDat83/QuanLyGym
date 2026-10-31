import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    config: {
      price: { type: Number, required: true, min: 0 }, // VND
      durationDays: { type: Number, required: true, min: 1, validate: Number.isInteger },
      ptSessions: { type: Number, required: true, min: 0, validate: Number.isInteger },
      isActive: { type: Boolean, default: true }, // false = ngừng bán
    },
  },
  { timestamps: true }
);

export default mongoose.model("Package", packageSchema);
