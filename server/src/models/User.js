import mongoose from "mongoose";

export const ROLES = ["admin", "trainer", "member"];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    phone: { type: String, trim: true },
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true }, // false = bị khóa
    tokenVersion: { type: Number, default: 0, select: false }, // tăng khi khóa/đổi quyền để thu hồi phiên
    deletedAt: { type: Date, default: null }, // xóa mềm: biến mất khỏi danh sách hoạt động
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret.passwordHash;
        delete ret.tokenVersion;
        return ret;
      },
    },
  }
);

export default mongoose.model("User", userSchema);
