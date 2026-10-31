import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emailSchema = z.string().trim().toLowerCase().regex(EMAIL_RE, "Email không hợp lệ");

// Mật khẩu: tối thiểu 8 ký tự, có chữ và số
export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(100)
  .regex(/[A-Za-z]/, "Mật khẩu phải có chữ")
  .regex(/[0-9]/, "Mật khẩu phải có số");

// Họ tên: trim, 1-100 ký tự (BR.08)
export const fullNameSchema = z.string().trim().min(1, "Vui lòng nhập họ tên").max(100, "Họ tên tối đa 100 ký tự");

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9 +().-]{8,20}$/, "Số điện thoại không hợp lệ");

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD");
