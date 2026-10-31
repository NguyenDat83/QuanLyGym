import { useState } from "react";
import { LoadState, useApi } from "../../lib/useApi";
import { addKeyDays, keyToVi, vnDateKey, vnTime } from "../../lib/format";
import { Button, Card, EmptyState, Icon, PageTitle, StatusPill } from "../../components/ui";

const RANGES: [string, string][] = [["today", "Hôm nay"], ["7d", "7 ngày qua"], ["30d", "30 ngày qua"], ["all", "Tất cả"]];
const STATUS: Record<string, [string, "green" | "blue"]> = { CheckedIn: ["Đã check-in", "blue"], Completed: ["Đã tập xong", "green"] };

// Điểm bắt đầu của một ngày theo giờ Việt Nam, dạng ISO để gửi lên server
const startOfDayIso = (key: string) => new Date(`${key}T00:00:00+07:00`).toISOString();

export function CheckinHistory() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [range, setRange] = useState("7d");
  const [detail, setDetail] = useState<any | null>(null);
  const today = vnDateKey(new Date());
  const days = range === "today" ? 0 : range === "7d" ? 6 : range === "30d" ? 29 : -1;
  const params = new URLSearchParams();
  if (days >= 0) params.set("from", startOfDayIso(addKeyDays(today, -days)));
  if (applied.trim()) params.set("q", applied.trim());
  const { data, error, loading } = useApi<any[]>(`/checkins/history?${params.toString()}`);
  const rows = data ?? [];
  const exportCsv = () => {
    const head = ["Mã check-in", "Mã hội viên", "Họ tên", "Ngày", "Giờ", "HLV", "Nhân viên", "Trạng thái"];
    const lines = rows.map((c) => [String(c._id).slice(-8).toUpperCase(), c.memberId?.code, c.memberId?.fullName, keyToVi(vnDateKey(c.checkInTime)), vnTime(c.checkInTime), c.trainerId?.fullName, c.checkedInBy?.fullName ?? "", STATUS[c.status]?.[0] ?? c.status]);
    const csv = [head, ...lines].map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `lich-su-check-in-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageTitle title="Lịch sử check-in" desc="Tra cứu các lượt check-in đã được ghi nhận trong hệ thống." action={<Button secondary onClick={exportCsv} disabled={!rows.length}><Icon name="file" size={16} /> Xuất CSV</Button>} />
      <div className="flex gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4">
          <Icon name="search" size={17} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setApplied(q)} className="w-full py-3 text-sm outline-none" placeholder="Tìm theo mã hoặc tên hội viên, số điện thoại... (Enter để tìm)" />
        </div>
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 text-xs">{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <Button onClick={() => setApplied(q)}>Tìm</Button>
      </div>
      <Card className="mt-5 overflow-hidden">
        <LoadState error={error} loading={loading} />
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr>{["Mã check-in", "Mã hội viên", "Họ tên", "Ngày", "Giờ", "HLV", "Nhân viên", "Trạng thái", ""].map((x) => <th key={x} className="p-3">{x}</th>)}</tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c._id} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-blue-600">{String(c._id).slice(-8).toUpperCase()}</td>
                <td className="p-3">{c.memberId?.code}</td>
                <td className="p-3 font-semibold">{c.memberId?.fullName}</td>
                <td className="p-3">{keyToVi(vnDateKey(c.checkInTime))}</td>
                <td className="p-3">{vnTime(c.checkInTime)}</td>
                <td className="p-3">{c.trainerId?.fullName ?? "—"}</td>
                <td className="p-3">{c.checkedInBy?.fullName ?? "—"}</td>
                <td className="p-3"><StatusPill tone={STATUS[c.status]?.[1] ?? "slate"}>{STATUS[c.status]?.[0] ?? c.status}</StatusPill></td>
                <td className="p-3"><button onClick={() => setDetail(c)} className="font-semibold text-blue-600">Chi tiết</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="p-6"><EmptyState text="Không có lượt check-in nào trong khoảng này." /></div>}
      </Card>
      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6">
          <Card className="w-full max-w-xl p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><StatusPill tone={STATUS[detail.status]?.[1] ?? "slate"}>{STATUS[detail.status]?.[0] ?? detail.status}</StatusPill><h2 className="mt-3 text-xl font-bold">Chi tiết bản ghi check-in</h2></div>
              <button onClick={() => setDetail(null)} className="text-slate-400"><Icon name="x" /></button>
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
              {[["Mã check-in", String(detail._id).slice(-8).toUpperCase()], ["Hội viên", `${detail.memberId?.code} · ${detail.memberId?.fullName}`], ["Huấn luyện viên", detail.trainerId?.fullName ?? "—"], ["Thời gian vào", `${keyToVi(vnDateKey(detail.checkInTime))} ${vnTime(detail.checkInTime)}`], ["Nhân viên xác nhận", detail.checkedInBy?.fullName ?? "—"], ["Hoàn thành buổi tập", detail.completedAt ? vnTime(detail.completedAt) : "Chưa ghi nhận"]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-200 py-2 last:border-0"><span className="text-slate-500">{k}</span><b>{v}</b></div>)}
            </div>
            {detail.workoutLog?.length > 0 && (
              <div className="mt-4"><b className="text-sm">Kết quả buổi tập</b>{detail.workoutLog.map((w: any, i: number) => <p key={i} className="mt-1 text-xs text-slate-600">• {w.exerciseName}: {w.actualSets ?? "—"} hiệp × {w.actualReps ?? "—"} lần{w.loadKg ? `, ${w.loadKg}kg` : ""}{w.trainerNote ? ` — ${w.trainerNote}` : ""}</p>)}</div>
            )}
            <div className="mt-6 text-right"><Button onClick={() => setDetail(null)}>Đóng</Button></div>
          </Card>
        </div>
      )}
    </>
  );
}
