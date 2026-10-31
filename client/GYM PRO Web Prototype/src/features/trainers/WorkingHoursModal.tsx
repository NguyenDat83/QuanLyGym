import { useState } from "react";
import type { Trainer } from "../../types";
import { api } from "../../api";
import { addKeyDays, vnDateKey } from "../../lib/format";
import { Button, Card } from "../../components/ui";

const DAYS: [number, string][] = [[1, "T2"], [2, "T3"], [3, "T4"], [4, "T5"], [5, "T6"], [6, "T7"], [0, "CN"]];

// Thiết lập / gỡ khung giờ làm việc (slot 60 phút) theo khoảng ngày. HLV chỉ làm cho mình, Admin chọn HLV.
export function WorkingHoursModal({ trainers, isAdmin, onClose, onDone }: { trainers: Trainer[]; isAdmin: boolean; onClose: () => void; onDone: () => void }) {
  const today = vnDateKey(new Date());
  const [trainerId, setTrainerId] = useState(trainers[0]?._id ?? "");
  const [fromDate, setFrom] = useState(addKeyDays(today, 1));
  const [toDate, setTo] = useState(addKeyDays(today, 14));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startHour, setStart] = useState(7);
  const [endHour, setEnd] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const toggle = (d: number) => setWeekdays(weekdays.includes(d) ? weekdays.filter(x => x !== d) : [...weekdays, d]);
  const run = async (remove: boolean) => {
    setError(""); setResult("");
    if (isAdmin && !trainerId) { setError("Vui lòng chọn huấn luyện viên."); return; }
    if (!weekdays.length) { setError("Chọn ít nhất một ngày trong tuần."); return; }
    if (endHour <= startHour) { setError("Giờ kết thúc phải sau giờ bắt đầu."); return; }
    if (remove && !window.confirm("Gỡ các khung giờ còn trống trong khoảng này? Khung giờ đã có người đặt sẽ được giữ lại.")) return;
    setBusy(true);
    try {
      const body = { ...(isAdmin ? { trainerId } : {}), fromDate, toDate, weekdays, startHour, endHour };
      if (remove) {
        const r: any = await api.post("/schedules/range/remove", body);
        setResult(`Đã gỡ ${r.removed} khung giờ trống${r.kept ? `, giữ lại ${r.kept} khung giờ đã có lịch` : ""}.`);
      } else {
        const r: any = await api.post("/schedules/range", body);
        const why = Object.entries(r.reasons ?? {}).map(([k, v]) => `${v} × ${k}`).join("; ");
        setResult(`Đã tạo ${r.created} khung giờ${r.skipped ? `, bỏ qua ${r.skipped}${why ? ` (${why})` : ""}` : ""}.`);
      }
      onDone();
    } catch (e: any) {
      setError(e?.message || "Không thực hiện được");
    }
    setBusy(false);
  };
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const input = "mt-2 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal outline-none focus:border-blue-500";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6"><Card className="w-full max-w-lg p-6 shadow-2xl">
    <h2 className="text-xl font-bold">Thiết lập giờ làm việc</h2>
    <p className="mt-1 text-sm text-slate-500">Tạo các khung giờ 60 phút để hội viên đặt lịch. Chỉ tạo trong giờ mở cửa và ở tương lai.</p>
    {isAdmin && <label className="mt-4 block text-sm font-semibold">Huấn luyện viên<select value={trainerId} onChange={e => setTrainerId(e.target.value)} className={input}>{trainers.filter(t => t.status === "Đang hoạt động").map(t => <option key={t._id} value={t._id}>{t.name} ({t.id})</option>)}</select></label>}
    <div className="mt-4 grid grid-cols-2 gap-4">
      <label className="block text-sm font-semibold">Từ ngày<input type="date" value={fromDate} min={today} onChange={e => setFrom(e.target.value)} className={input} /></label>
      <label className="block text-sm font-semibold">Đến ngày<input type="date" value={toDate} min={fromDate} onChange={e => setTo(e.target.value)} className={input} /></label>
    </div>
    <div className="mt-4 text-sm font-semibold">Các ngày trong tuần<div className="mt-2 flex gap-2">{DAYS.map(([d, l]) => <button key={d} type="button" onClick={() => toggle(d)} className={`h-10 w-10 rounded-xl border text-xs font-bold ${weekdays.includes(d) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600"}`}>{l}</button>)}</div></div>
    <div className="mt-4 grid grid-cols-2 gap-4">
      <label className="block text-sm font-semibold">Từ giờ<select value={startHour} onChange={e => setStart(Number(e.target.value))} className={input}>{hours.slice(0, 23).map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>
      <label className="block text-sm font-semibold">Đến giờ<select value={endHour} onChange={e => setEnd(Number(e.target.value))} className={input}>{hours.slice(1).concat(24).map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>
    </div>
    <p className="mt-2 text-xs text-slate-400">Ví dụ 07:00 → 12:00 tạo 5 khung: 7h, 8h, 9h, 10h, 11h.</p>
    {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    {result && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{result}</p>}
    <div className="mt-6 flex items-center justify-between"><Button secondary danger disabled={busy} onClick={() => run(true)}>Gỡ giờ trống</Button><div className="flex gap-3"><Button secondary onClick={onClose}>Đóng</Button><Button disabled={busy} onClick={() => run(false)}>{busy ? "Đang xử lý..." : "Tạo khung giờ"}</Button></div></div>
  </Card></div>;
}
