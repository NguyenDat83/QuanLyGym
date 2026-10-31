import { useState } from "react";
import { LoadState, useApi } from "../../lib/useApi";
import { addKeyDays, keyToVi, vnDateKey } from "../../lib/format";
import { Card, EmptyState, MetricCard, PageTitle } from "../../components/ui";

const RANGES: [string, string, number][] = [["7d", "7 ngày qua", 6], ["30d", "30 ngày qua", 29], ["90d", "90 ngày qua", 89]];

// Báo cáo vận hành lấy từ /api/stats (chỉ Admin)
export function CheckinReport() {
  const [range, setRange] = useState("7d");
  const to = vnDateKey(new Date());
  const from = addKeyDays(to, -(RANGES.find((r) => r[0] === range)?.[2] ?? 6));
  const qs = `from=${from}&to=${to}`;
  const checkins = useApi<any>(`/stats/checkins?${qs}&unit=day`);
  const cancel = useApi<any>(`/stats/cancellations?${qs}`);
  const trainers = useApi<any>(`/stats/trainers?${qs}`);
  const items: any[] = checkins.data?.items ?? [];
  const max = Math.max(1, ...items.map((i) => i.checkins));
  const days = Math.max(1, (RANGES.find((r) => r[0] === range)?.[2] ?? 6) + 1);
  const total = checkins.data?.totalCheckins ?? 0;
  const c = cancel.data;
  return (
    <>
      <PageTitle title="Báo cáo check-in" desc="Số liệu thật từ hệ thống: lượt check-in, hủy lịch, không đến và hiệu suất HLV." action={<select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs">{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>} />
      <LoadState error={checkins.error || cancel.error || trainers.error} loading={checkins.loading || cancel.loading} />
      <div className="mb-5 grid grid-cols-4 gap-4">
        <MetricCard icon="check" label="Tổng lượt check-in" value={String(total)} note={`${keyToVi(from)} – ${keyToVi(to)}`} tone="green" />
        <MetricCard icon="users" label="Trung bình mỗi ngày" value={(total / days).toFixed(1)} note="Lượt check-in" tone="blue" />
        <MetricCard icon="alert" label="Tỷ lệ hủy lịch" value={`${c?.cancelRate ?? 0}%`} note={`${c?.cancelled ?? 0}/${c?.dueAppointments ?? 0} lịch đến hạn`} tone="orange" />
        <MetricCard icon="clock" label="Tỷ lệ không đến" value={`${c?.noShowRate ?? 0}%`} note={`${c?.noShow ?? 0} lượt không đến`} tone="red" />
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <Card className="p-5">
          <h2 className="font-bold">Lượt check-in theo ngày</h2>
          {items.length === 0 ? <div className="mt-4"><EmptyState text="Chưa có lượt check-in trong khoảng này." /></div> : (
            <div className="mt-6 flex h-48 items-end gap-2">
              {items.map((i) => (
                <div key={i.period} className="flex flex-1 flex-col items-center justify-end" title={`${keyToVi(i.period)}: ${i.checkins} lượt, ${i.uniqueMembers} hội viên`}>
                  <span className="mb-1 text-[10px] font-semibold text-slate-600">{i.checkins}</span>
                  <div className="w-full rounded-t-lg bg-blue-500" style={{ height: `${Math.max(4, (i.checkins / max) * 100)}%` }} />
                  <span className="mt-2 text-[9px] text-slate-400">{i.period.slice(8, 10)}/{i.period.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">Buổi tập hoàn thành theo HLV</h2>
          {(trainers.data?.items ?? []).length === 0 ? <div className="mt-4"><EmptyState text="Chưa có buổi hoàn thành." /></div> : (
            <div className="mt-4 space-y-3">
              {(trainers.data.items as any[]).map((t) => (
                <div key={t.trainerId} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <b>{t.fullName ?? "HLV"}</b>
                  <p className="mt-1 text-xs text-slate-500">{t.sessions} buổi · {t.hours} giờ · {t.uniqueMembers} hội viên</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
