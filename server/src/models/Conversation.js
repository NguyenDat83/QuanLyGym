import mongoose from "mongoose";

// Hội thoại trực tiếp giữa 2 tài khoản. key = "<idNhỏ>:<idLớn>" để mỗi cặp chỉ có một hội thoại.
const conversationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], validate: (v) => v.length === 2 },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageText: { type: String, default: "" },
    lastSenderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);
