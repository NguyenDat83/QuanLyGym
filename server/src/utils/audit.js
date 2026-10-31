import { AuditLog } from "../models/index.js";

export async function audit(actorId, action, targetType, targetId, detail = {}) {
  try {
    await AuditLog.create({ actorId, action, targetType, targetId, detail });
  } catch (e) {
    console.error("audit error:", e.message);
  }
}
