import { useEffect, useState } from "react";
import { api } from "../../api";
import { vnDateKey, vnTime } from "../../lib/format";

// ===== Kiểu dữ liệu từ API tin nhắn / hỗ trợ / thông báo / nhật ký =====
export type Contact = { id: string; name: string; role: string; code: string };
export type ConversationItem = { id: string; other: Contact; lastMessageAt: string; lastMessageText: string; lastSenderId: string | null; unread: number };
export type ChatMessage = { id: string; senderId: string; body: string; createdAt: string; readBy: string[] };
export type NoticeItem = { _id: string; icon: string; title: string; body: string; target: string; read: boolean; createdAt: string };
export type TicketStatus = "Mới" | "Đã tiếp nhận" | "Đang xử lý" | "Chờ phản hồi" | "Đã giải quyết" | "Đã đóng";
export const TICKET_STATUSES: TicketStatus[] = ["Mới", "Đã tiếp nhận", "Đang xử lý", "Chờ phản hồi", "Đã giải quyết", "Đã đóng"];
export type TicketItem = {
  id: string; code: string; senderId: string; senderName: string; senderRole: string; title: string; category: string; priority: string; content: string;
  status: TicketStatus; assigneeId: string | null; assigneeName: string; internalNote?: string; createdAt: string; updatedAt: string;
  replies: { senderId: string; sender: string; body: string; createdAt: string }[];
};
export type AuditItem = { id: string; at: string; actor: string; action: string; actionCode: string; object: string; result: string };

// ===== Hiển thị thời gian =====
export function fmtWhen(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "Vừa xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  const key = vnDateKey(iso);
  if (key === vnDateKey(new Date())) return vnTime(iso);
  return `${key.slice(8, 10)}/${key.slice(5, 7)} ${vnTime(iso)}`;
}
export const fmtFull = (iso: string) => `${vnDateKey(iso).split("-").reverse().join("/")} · ${vnTime(iso)}`;

// ===== Số chưa đọc có tự làm mới; các màn hình gọi refreshUnread() sau khi đọc =====
const EVT = "gympro:unread";
export const refreshUnread = () => window.dispatchEvent(new Event(EVT));

export function useUnread(path: string, everyMs = 20000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => api.get(path).then((r: any) => alive && setCount(r.count ?? 0)).catch(() => {});
    load();
    const timer = setInterval(load, everyMs);
    window.addEventListener(EVT, load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(EVT, load);
    };
  }, [path, everyMs]);
  return count;
}

// Gọi hàm định kỳ (làm mới danh sách khi đang mở màn hình)
export function useInterval(fn: () => void, ms: number) {
  useEffect(() => {
    const timer = setInterval(fn, ms);
    return () => clearInterval(timer);
  });
}
