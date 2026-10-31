import { useEffect, useState } from "react";
import { api } from "../../api";
import { useApi, LoadState } from "../../lib/useApi";
import type { Role } from "../../types";
import { Button, Card, EmptyState, Icon, PageTitle, StatusPill } from "../../components/ui";
import { fmtWhen, refreshUnread, useInterval, type ChatMessage, type Contact, type ConversationItem } from "./commApi";

export function MessageCenter({ meId, role }: { meId: string; role: Role }) {
  const convs = useApi<ConversationItem[]>("/messages/conversations");
  const contacts = useApi<Contact[]>("/messages/contacts");
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgError, setMsgError] = useState("");
  const [query, setQuery] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [text, setText] = useState("");
  const [newContact, setNewContact] = useState("");
  const [sending, setSending] = useState(false);

  const list = convs.data ?? [];
  const filtered = list.filter(item => item.other.name.toLowerCase().includes(query.toLowerCase()) && (!onlyUnread || item.unread > 0));
  const selected = list.find(item => item.id === selectedId);

  const loadMessages = async (id: string) => {
    try {
      setMessages(await api.get(`/messages/conversations/${id}/messages`));
      setMsgError("");
      refreshUnread();
    } catch (e: any) {
      setMsgError(e?.message || "Không tải được tin nhắn");
    }
  };
  // chọn hội thoại đầu tiên khi có dữ liệu
  useEffect(() => {
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }, [list.length]);
  useEffect(() => {
    if (selectedId) loadMessages(selectedId).then(() => convs.reload());
  }, [selectedId]);
  // làm mới định kỳ để nhận tin mới
  useInterval(() => {
    convs.reload();
    if (selectedId) loadMessages(selectedId);
  }, 8000);

  const send = async () => {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    try {
      const m: ChatMessage = await api.post(`/messages/conversations/${selected.id}/messages`, { body: text.trim() });
      setMessages(prev => [...prev, m]);
      setText("");
      convs.reload();
    } catch (e: any) {
      setMsgError(e?.message || "Không gửi được tin nhắn");
    }
    setSending(false);
  };
  const start = async () => {
    if (!newContact) return;
    try {
      const r = await api.post("/messages/conversations", { userId: newContact });
      setNewContact("");
      setSelectedId(r.id);
      convs.reload();
    } catch (e: any) {
      setMsgError(e?.message || "Không tạo được hội thoại");
    }
  };
  const initial = (name: string) => name.split(" ").at(-1)?.[0] ?? "?";
  return <><PageTitle title={role === "ADMIN" ? "Trung tâm liên lạc" : "Tin nhắn"} desc="Hội thoại trực tiếp giữa Hội viên, HLV và Admin; tin nhắn mới được cập nhật mỗi vài giây." action={<div className="flex gap-2"><select value={newContact} onChange={e => setNewContact(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="">Chọn người liên hệ</option>{(contacts.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}</select><Button onClick={start} disabled={!newContact}>Cuộc trò chuyện mới</Button></div>}/>
    <LoadState error={convs.error || contacts.error || msgError} loading={convs.loading && !convs.data}/>
    <Card className="grid h-[650px] grid-cols-[280px_1fr_260px] overflow-hidden">
      <div className="border-r border-slate-100"><div className="border-b border-slate-100 p-4"><div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3"><Icon name="search" size={16}/><input value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-transparent py-2.5 text-xs outline-none" placeholder="Tìm hội thoại..."/></div><select value={onlyUnread ? "unread" : "all"} onChange={e => setOnlyUnread(e.target.value === "unread")} className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-xs"><option value="all">Tất cả hội thoại</option><option value="unread">Chưa đọc</option></select></div>
        <div className="max-h-[560px] overflow-y-auto">{filtered.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left ${selected?.id === item.id ? "bg-blue-50" : "hover:bg-slate-50"}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{initial(item.other.name)}</span><span className="min-w-0 flex-1"><span className="flex justify-between"><b className="truncate text-xs">{item.other.name}</b><small className="text-[9px] text-slate-400">{fmtWhen(item.lastMessageAt)}</small></span><span className="mt-1 block text-[10px] text-blue-600">{item.other.role}</span><span className="mt-1 flex items-center gap-2"><span className="truncate text-[11px] text-slate-500">{item.lastMessageText || "Bắt đầu cuộc trò chuyện"}</span>{item.unread > 0 && <i className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-[9px] not-italic text-white">{item.unread}</i>}</span></span></button>)}{!filtered.length && !convs.loading && <div className="p-4"><EmptyState text="Chưa có hội thoại. Chọn người liên hệ để bắt đầu."/></div>}</div></div>
      {selected ? <><div className="flex min-w-0 flex-col"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><b className="text-sm">{selected.other.name}</b><p className="mt-1 text-xs text-slate-500">{selected.other.role}{selected.other.code ? ` · ${selected.other.code}` : ""}</p></div><StatusPill tone="blue">Trực tiếp</StatusPill></div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-5">{messages.map(msg => <div key={msg.id} className={`flex ${msg.senderId === meId ? "justify-end" : "justify-start"}`}><div className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm ${msg.senderId === meId ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}><p className="whitespace-pre-wrap break-words">{msg.body}</p><p className={`mt-2 text-[9px] ${msg.senderId === meId ? "text-blue-200" : "text-slate-400"}`}>{fmtWhen(msg.createdAt)}{msg.senderId === meId ? ` · ${msg.readBy.length > 1 ? "Đã đọc" : "Đã gửi"}` : ""}</p></div></div>)}{!messages.length && <EmptyState text="Chưa có tin nhắn. Hãy bắt đầu trao đổi."/>}</div>
        <div className="border-t border-slate-100 p-4"><div className="flex items-end gap-2 rounded-xl border border-slate-200 p-2"><textarea value={text} maxLength={2000} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} className="max-h-24 min-h-10 flex-1 resize-none p-2 text-sm outline-none" placeholder="Nhập tin nhắn (Enter để gửi)..."/><Button onClick={send} disabled={!text.trim() || sending} className="py-2">Gửi</Button></div></div></div>
        <div className="border-l border-slate-100 p-5"><div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-900 text-xl font-bold text-white">{initial(selected.other.name)}</span><h3 className="mt-3 font-bold">{selected.other.name}</h3><p className="mt-1 text-xs text-blue-600">{selected.other.role}</p></div><div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-xs"><p><span className="block text-slate-400">Mã tài khoản</span><b>{selected.other.code || "—"}</b></p><p><span className="block text-slate-400">Quyền xem</span><b>Thông tin liên hệ cơ bản</b></p></div></div></>
      : <div className="col-span-2 grid place-items-center"><EmptyState text="Chọn một hội thoại để bắt đầu."/></div>}
    </Card></>;
}
