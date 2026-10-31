import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    icon: { type: String, default: "bell" },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    target: { type: String, default: "notifications" }, // tên trang trên giao diện
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export default mongoose.model("Notification", notificationSchema);
