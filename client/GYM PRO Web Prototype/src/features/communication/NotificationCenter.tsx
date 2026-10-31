import { useState } from "react";
import type { Page } from "../../types";
import { api } from "../../api";
import { useApi, LoadState } from "../../lib/useApi";
import { Button, Card, EmptyState, Icon, PageTitle } from "../../components/ui";
import { fmtWhen, refreshUnread, useInterval, type NoticeItem } from "./commApi";

const FILTERS: Record<string, string[] | null> = { "Tất cả": null, "Lịch": ["calendar"], "Tin nhắn": ["message"], "Hỗ trợ": ["help"], "Check-in": ["check", "scan", "clipboard"] };

export function NotificationCenter({ setPage }: { setPage: (page: Page) => void }) {
  const { data, error, loading, reload } = useApi<NoticeItem[]>("/notifications");
  const [filter, setFilter] = useState("Tất cả");
  useInterval(reload, 30000);
  const icons = FILTERS[filter];
  const visible = (data ?? []).filter(item => !icons || icons.includes(item.icon));
  const open = async (item: NoticeItem) => {
    if (!item.read) await api.post(`/notifications/${item._id}/read`).catch(() => {});
    refreshUnread();
    setPage(item.target as Page);
  };
  const readAll = async () => {
    await api.post("/notifications/read-all").catch(() => {});
    refreshUnread();
    reload();
  };
  return <><PageTitle title="Thông báo" desc="Cập nhật đúng theo tài khoản và dữ liệu liên quan." action={<Button secondary onClick={readAll}>Đánh dấu tất cả đã đọc</Button>}/>
    <LoadState error={error} loading={loading && !data}/>
    <div className="mb-4 flex gap-2">{Object.keys(FILTERS).map(item => <button key={item} onClick={() => setFilter(item)} className={`rounded-full px-4 py-2 text-xs font-semibold ${filter === item ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-500"}`}>{item}</button>)}</div>
    <Card className="overflow-hidden">{visible.map(item => <button key={item._id} onClick={() => open(item)} className={`flex w-full gap-4 border-b border-slate-100 p-5 text-left last:border-0 ${!item.read ? "bg-blue-50/50" : "hover:bg-slate-50"}`}><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon name={item.icon}/></span><span className="flex-1"><span className="flex justify-between"><b className="text-sm">{item.title}{!item.read && <i className="ml-2 inline-block h-2 w-2 rounded-full bg-blue-600"/>}</b><small className="text-slate-400">{fmtWhen(item.createdAt)}</small></span><span className="mt-1 block text-sm text-slate-500">{item.body}</span></span></button>)}{!visible.length && !loading && <div className="p-6"><EmptyState text="Không có thông báo phù hợp."/></div>}</Card></>;
}
