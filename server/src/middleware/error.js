import { HttpError } from "../utils/http.js";

export function notFound(_req, res) {
  res.status(404).json({ message: "Không tìm thấy đường dẫn" });
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...err.extra });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "dữ liệu";
    return res.status(409).json({ message: `Giá trị của "${field}" đã tồn tại`, field });
  }
  if (err?.name === "ValidationError") {
    return res.status(422).json({
      message: "Dữ liệu không hợp lệ",
      errors: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ message: `Giá trị không hợp lệ: ${err.path}` });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "JSON không hợp lệ" });
  }
  console.error(err);
  res.status(500).json({ message: "Lỗi máy chủ" });
}
