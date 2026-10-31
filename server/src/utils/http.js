import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const httpError = (status, message, extra) => new HttpError(status, message, extra);

// Bọc handler async để lỗi được chuyển vào error middleware
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Kiểm tra dữ liệu bằng zod, lỗi trả 422
export function parse(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    throw httpError(422, "Dữ liệu không hợp lệ", {
      errors: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return r.data;
}

export function oid(id, name = "id") {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, `${name} không hợp lệ`);
  return id;
}

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
