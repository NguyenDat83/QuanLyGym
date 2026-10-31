import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { httpError, wrap } from "../utils/http.js";

// Xác thực JWT + kiểm tra tài khoản còn hoạt động / chưa bị thu hồi phiên
export const auth = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) throw httpError(401, "Chưa đăng nhập");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
  }

  const user = await User.findById(payload.sub).select("+tokenVersion");
  if (!user || user.deletedAt || !user.isActive || user.tokenVersion !== payload.tv) {
    throw httpError(401, "Phiên đăng nhập đã bị thu hồi");
  }
  req.user = user;
  next();
});

// Chỉ cho phép các vai trò được liệt kê (kiểm tra quyền ở API, BR.08)
export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(httpError(403, "Bạn không có quyền thực hiện thao tác này"));
