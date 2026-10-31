import { useEffect, useState } from "react";
import { useApi, LoadState } from "../../lib/useApi";
import { Button, Card, EmptyState, Icon, PageTitle, StatusPill } from "../../components/ui";
import { fmtFull, type AuditItem } from "./commApi";

export function ActivityLogs() {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setQ(query.trim()); setPage(1); }, 350); // chờ người dùng gõ xong
    return () => clearTimeout(t);
  }, [query]);
  const { data, error, loading } = useApi<{ items: AuditItem[]; total: number; page: number; pages: number }>(`/audit-logs?limit=30&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const rows = data?.items ?? [];
  const exportCsv = () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = ["Thời gian,Người thực hiện,Hành động,Đối tượng,Kết quả", ...rows.map(r => [fmtFull(r.at), r.actor, r.action, r.object, r.result].map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "nhat-ky-hoat-dong.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  return <><PageTitle title="Nhật ký hoạt động" desc="Theo dõi các thao tác quan trọng; người dùng thông thường không thể chỉnh sửa." action={<Button secondary onClick={exportCsv} disabled={!rows.length}><Icon name="file" size={16}/> Xuất nhật ký</Button>}/>
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4"><Icon name="search" size={17}/><input value={query} onChange={e => setQuery(e.target.value)} className="w-full py-3 text-sm outline-none" placeholder="Tìm người thực hiện hoặc hành động..."/></div>
    <div className="mt-4"><LoadState error={error} loading={loading && !data}/></div>
    <Card className="mt-1 overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{["Thời gian", "Người thực hiện", "Hành động", "Đối tượng", "Kết quả"].map(x => <th key={x} className="px-5 py-3">{x}</th>)}</tr></thead><tbody>{rows.map(item => <tr key={item.id} className="border-t border-slate-100"><td className="px-5 py-4 text-slate-500">{fmtFull(item.at)}</td><td className="px-5 py-4 font-semibold">{item.actor}</td><td className="px-5 py-4">{item.action}</td><td className="px-5 py-4 text-blue-600">{item.object}</td><td className="px-5 py-4"><StatusPill tone="green">{item.result}</StatusPill></td></tr>)}{!rows.length && !loading && <tr><td colSpan={5} className="p-6"><EmptyState text="Chưa có nhật ký phù hợp."/></td></tr>}</tbody></table></Card>
    {data && data.pages > 1 && <div className="mt-4 flex items-center justify-end gap-3 text-xs"><span className="text-slate-500">Trang {data.page}/{data.pages} · {data.total} bản ghi</span><Button secondary disabled={page <= 1} onClick={() => setPage(page - 1)} className="py-2">‹ Trước</Button><Button secondary disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="py-2">Sau ›</Button></div>}</>;
}
