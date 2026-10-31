// Lớp gọi API của GYM PRO. Mặc định gọi "/api/..." và được Vite proxy sang server (http://localhost:4000).
// Nếu deploy tách domain, đặt VITE_API_URL=https://ten-mien-api (không có dấu / ở cuối).
const BASE: string = (import.meta as any).env?.VITE_API_URL ?? "";
const KEY = "gympro_token";

let token: string | null = null;
try {
  token = sessionStorage.getItem(KEY);
} catch {
  /* sessionStorage có thể bị chặn */
}

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: { path: string; message: string }[];
  constructor(message: string, status: number, extra: { code?: string; errors?: { path: string; message: string }[] } = {}) {
    super(message);
    this.status = status;
    this.code = extra.code;
    this.errors = extra.errors;
  }
}

async function request(method: string, path: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Hãy chắc chắn server đang chạy (npm run dev trong thư mục server).", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const first = data?.errors?.[0]?.message;
    throw new ApiError(first || data?.message || `Lỗi ${res.status}`, res.status, { code: data?.code, errors: data?.errors });
  }
  return data;
}

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body ?? {}),
  patch: (path: string, body?: unknown) => request("PATCH", path, body ?? {}),
  put: (path: string, body?: unknown) => request("PUT", path, body ?? {}),
  del: (path: string) => request("DELETE", path),
  setToken(t: string | null) {
    token = t;
    try {
      if (t) sessionStorage.setItem(KEY, t);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* bỏ qua */
    }
  },
  hasToken: () => !!token,
};
