import mongoose from "mongoose";

const auditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, required: true },
  targetType: String,
  targetId: mongoose.Schema.Types.Mixed,
  detail: mongoose.Schema.Types.Mixed,
  at: { type: Date, default: Date.now },
});

export default mongoose.model("AuditLog", auditSchema);
