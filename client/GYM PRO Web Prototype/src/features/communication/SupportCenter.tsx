import { useState } from "react";
import type { Role } from "../../types";
import { api } from "../../api";
import { useApi, LoadState } from "../../lib/useApi";
import { Button, Card, EmptyState, Icon, PageTitle, StatusPill } from "../../components/ui";
import { fmtFull, fmtWhen, TICKET_STATUSES, useInterval, type Contact, type TicketItem, type TicketStatus } from "./commApi";

const CATEGORIES = ["Tài khoản", "Lịch tập", "HLV", "Gói hội viên", "Check-in", "Lỗi hệ thống", "Khiếu nại", "Khác"];
const emptyDraft = { title: "", category: "Tài khoản", priority: "Trung bình", content: "" };

export function SupportCenter({ meId, meName, role }: { meId: string; meName: string; role: Role }) {
  const tickets = useApi<TicketItem[]>("/tickets");
  const contacts = useApi<Contact[]>(role === "ADMIN" ? "/messages/contacts" : null);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [note, setNote] = useState<{ id: string; value: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useInterval(tickets.reload, 15000);

  const all = tickets.data ?? [];
  const shown = all.filter(item => (filter === "Tất cả" || item.status === filter) && `${item.code} ${item.title}`.toLowerCase().includes(query.toLowerCase()));
  const selected = all.find(item => item.id === selectedId);
  const assignees = [{ id: meId, label: `Admin · ${meName}` }, ...(contacts.data ?? []).filter(c => c.role !== "HỘI VIÊN").map(c => ({ id: c.id, label: `${c.role === "HLV" ? "HLV" : "Admin"} · ${c.name}` }))];
  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setError("");
    try { await fn(); tickets.reload(); } catch (e: any) { setError(e?.message || "Thao tác không thành công"); }
    setBusy(false);
  };
  const create = () => run(async () => {
    const t: TicketItem = await api.post("/tickets", draft);
    setSelectedId(t.id); setCreating(false); setDraft(emptyDraft);
  });
  const patch = (changes: Record<string, unknown>) => selected && run(() => api.patch(`/tickets/${selected.id}`, changes));
  const sendReply = () => selected && reply.trim() && run(async () => { await api.post(`/tickets/${selected.id}/replies`, { body: reply.trim() }); setReply(""); });
  const noteValue = note && selected && note.id === selected.id ? note.value : selected?.internalNote ?? "";
  const count = (status: TicketStatus) => all.filter(item => item.status === status).length;
  const closed = selected?.status === "Đã đóng";
  return <><PageTitle title={role === "ADMIN" ? "Trung tâm hỗ trợ" : "Hỗ trợ GYM PRO"} desc={role === "ADMIN" ? "Tiếp nhận, phân công và theo dõi yêu cầu từ Hội viên, HLV." : "Tạo yêu cầu riêng để theo dõi một vấn đề cần giải quyết."} action={role !== "ADMIN" ? <Button onClick={() => setCreating(true)}><Icon name="plus" size={16}/> Tạo yêu cầu mới</Button> : undefined}/>
    <LoadState error={tickets.error || error} loading={tickets.loading && !tickets.data}/>
    <div className="mb-5 grid grid-cols-4 gap-3">{(["Mới", "Đang xử lý", "Chờ phản hồi", "Đã giải quyết"] as TicketStatus[]).map(status => <button key={status} onClick={() => setFilter(filter === status ? "Tất cả" : status)} className={`rounded-xl border p-4 text-left ${filter === status ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}><b className="text-xl">{count(status)}</b><span className="mt-1 block text-xs text-slate-500">{status}</span></button>)}</div>
    <div className="grid grid-cols-[.85fr_1.15fr] gap-5">
      <Card className="overflow-hidden"><div className="flex gap-2 border-b border-slate-100 p-4"><div className="flex flex-1 items-center gap-2 rounded-lg bg-slate-100 px-3"><Icon name="search" size={15}/><input value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-transparent py-2 text-xs outline-none" placeholder="Tìm mã hoặc tiêu đề..."/></div><select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 text-xs"><option>Tất cả</option>{TICKET_STATUSES.map(x => <option key={x}>{x}</option>)}</select></div>
        {shown.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`block w-full border-b border-slate-100 p-4 text-left ${selectedId === item.id ? "bg-blue-50" : "hover:bg-slate-50"}`}><div className="flex justify-between"><b className="text-xs text-blue-600">{item.code}</b><StatusPill tone={item.priority === "Cao" ? "red" : item.priority === "Trung bình" ? "orange" : "blue"}>{item.priority}</StatusPill></div><h3 className="mt-2 text-sm font-bold">{item.title}</h3><p className="mt-1 text-xs text-slate-500">{item.senderName} · {item.senderRole}</p><div className="mt-3 flex justify-between"><span className="text-[10px] text-slate-400">{fmtWhen(item.updatedAt)}</span><StatusPill tone={item.status === "Đã giải quyết" ? "green" : item.status === "Mới" ? "blue" : "orange"}>{item.status}</StatusPill></div></button>)}
        {!shown.length && !tickets.loading && <div className="p-5"><EmptyState text="Không có yêu cầu phù hợp."/></div>}</Card>
      <Card className="min-h-[520px] p-6">{selected ? <><div className="flex items-start justify-between border-b border-slate-100 pb-5"><div><span className="text-xs font-bold text-blue-600">{selected.code} · {selected.category}</span><h2 className="mt-2 text-xl font-bold">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.senderName} ({selected.senderRole}) · {fmtFull(selected.createdAt)}{selected.assigneeName ? ` · Phụ trách: ${selected.assigneeName}` : ""}</p></div><StatusPill tone={selected.status === "Đã giải quyết" ? "green" : "orange"}>{selected.status}</StatusPill></div>
        <div className="mt-5 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{selected.content}</div>
        {selected.replies.map((item, i) => <div key={i} className={`mt-4 rounded-xl border p-4 text-sm ${item.senderId === meId ? "border-slate-200 bg-white" : "border-blue-100 bg-blue-50"}`}><b className="text-blue-700">{item.sender}</b><p className="mt-1 whitespace-pre-wrap text-slate-600">{item.body}</p><span className="mt-2 block text-[10px] text-slate-400">{fmtFull(item.createdAt)}</span></div>)}
        {role === "ADMIN" && <div className="mt-5 grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Trạng thái<select value={selected.status} disabled={busy} onChange={e => patch({ status: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal">{TICKET_STATUSES.map(x => <option key={x}>{x}</option>)}</select></label><label className="text-xs font-semibold">Người phụ trách<select value={selected.assigneeId ?? ""} disabled={busy} onChange={e => patch({ assigneeId: e.target.value || null })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal"><option value="">Chưa phân công</option>{assignees.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label></div>}
        {closed ? <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Yêu cầu đã đóng, không thể phản hồi thêm.</p> : <div className="mt-5 flex gap-2"><textarea value={reply} maxLength={2000} onChange={e => setReply(e.target.value)} className="h-20 flex-1 resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500" placeholder="Nhập phản hồi hoặc thông tin bổ sung..."/><Button onClick={sendReply} disabled={!reply.trim() || busy}>Gửi phản hồi</Button></div>}
        {role === "ADMIN" && <label className="mt-3 block text-xs font-semibold text-slate-500">Ghi chú nội bộ (chỉ Admin thấy, tự lưu khi rời ô)<input value={noteValue} onChange={e => setNote({ id: selected.id, value: e.target.value })} onBlur={() => note && note.value !== (selected.internalNote ?? "") && patch({ internalNote: note.value })} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" placeholder="Chỉ Admin nhìn thấy..."/></label>}</> : <EmptyState text="Chọn một yêu cầu để xem chi tiết."/>}</Card></div>
    {creating && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6"><Card className="w-full max-w-xl p-6"><div className="flex justify-between"><div><h2 className="text-xl font-bold">Tạo yêu cầu hỗ trợ</h2><p className="mt-1 text-sm text-slate-500">Yêu cầu sẽ được gửi tới Trung tâm hỗ trợ Admin.</p></div><button onClick={() => setCreating(false)}><Icon name="x"/></button></div>
      <div className="mt-5 space-y-4"><label className="block text-xs font-semibold">Tiêu đề<input value={draft.title} maxLength={150} onChange={e => setDraft({ ...draft, title: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" placeholder="Mô tả ngắn vấn đề"/></label><div className="grid grid-cols-2 gap-4"><label className="text-xs font-semibold">Danh mục<select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal">{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label><label className="text-xs font-semibold">Mức độ ưu tiên<select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal"><option>Thấp</option><option>Trung bình</option><option>Cao</option></select></label></div><label className="block text-xs font-semibold">Nội dung<textarea value={draft.content} maxLength={3000} onChange={e => setDraft({ ...draft, content: e.target.value })} className="mt-2 h-28 w-full resize-none rounded-xl border border-slate-200 p-3 font-normal" placeholder="Cung cấp thông tin chi tiết..."/></label></div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-3"><Button secondary onClick={() => setCreating(false)}>Hủy</Button><Button onClick={create} disabled={!draft.title.trim() || !draft.content.trim() || busy}>Gửi yêu cầu</Button></div></Card></div>}</>;
}
