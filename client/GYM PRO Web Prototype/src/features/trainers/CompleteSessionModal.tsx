import { useState } from "react";
import type { BookingRecord } from "../../types";
import { api } from "../../api";
import { Button, Card } from "../../components/ui";

type Row = { exerciseName: string; actualSets: string; actualReps: string; loadKg: string; trainerNote: string };
const blank = (): Row => ({ exerciseName: "", actualSets: "", actualReps: "", loadKg: "", trainerNote: "" });
const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

// HLV ghi kết quả buổi tập đã check-in -> Completed
export function CompleteSessionModal({ booking, onClose, onDone }: { booking: BookingRecord; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const submit = async () => {
    setError("");
    const used = rows.filter(r => r.exerciseName.trim() || r.actualSets || r.actualReps || r.loadKg || r.trainerNote);
    if (used.some(r => !r.exerciseName.trim())) { setError("Mỗi dòng cần có tên bài tập."); return; }
    for (const r of used) for (const v of [r.actualSets, r.actualReps, r.loadKg]) if (v.trim() !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0)) { setError("Số set, rep, tạ phải là số không âm."); return; }
    if (used.some(r => [r.actualSets, r.actualReps].some(v => v.trim() !== "" && !Number.isInteger(Number(v))))) { setError("Số set và rep phải là số nguyên."); return; }
    setBusy(true);
    try {
      await api.post(`/checkins/${booking.id}/complete`, {
        workoutLog: used.map(r => ({ exerciseName: r.exerciseName.trim(), actualSets: num(r.actualSets), actualReps: num(r.actualReps), loadKg: num(r.loadKg), trainerNote: r.trainerNote.trim() || undefined })),
      });
      onDone();
    } catch (e: any) {
      setError(e?.message || "Không lưu được kết quả buổi tập");
      setBusy(false);
    }
  };
  const cell = "w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-blue-500";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6"><Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 shadow-2xl">
    <h2 className="text-xl font-bold">Ghi kết quả buổi tập</h2>
    <p className="mt-1 text-sm text-slate-500">{booking.memberName} · {booking.dateKey?.split("-").reverse().join("/")} lúc {booking.time}. Có thể để trống nếu chỉ muốn đánh dấu hoàn thành.</p>
    <div className="mt-4 grid grid-cols-[2fr_.7fr_.7fr_.7fr_2fr_auto] gap-2 text-[11px] font-semibold text-slate-500"><span>Bài tập</span><span>Set</span><span>Rep</span><span>Tạ (kg)</span><span>Ghi chú</span><span /></div>
    {rows.map((r, i) => <div key={i} className="mt-2 grid grid-cols-[2fr_.7fr_.7fr_.7fr_2fr_auto] gap-2">
      <input className={cell} value={r.exerciseName} placeholder="VD: Squat" onChange={e => set(i, "exerciseName", e.target.value)} />
      <input className={cell} inputMode="numeric" value={r.actualSets} onChange={e => set(i, "actualSets", e.target.value)} />
      <input className={cell} inputMode="numeric" value={r.actualReps} onChange={e => set(i, "actualReps", e.target.value)} />
      <input className={cell} inputMode="decimal" value={r.loadKg} onChange={e => set(i, "loadKg", e.target.value)} />
      <input className={cell} value={r.trainerNote} maxLength={500} onChange={e => set(i, "trainerNote", e.target.value)} />
      <button type="button" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [blank()])} className="px-2 text-slate-400 hover:text-red-600" aria-label="Xóa dòng">✕</button>
    </div>)}
    {rows.length < 50 && <button type="button" onClick={() => setRows([...rows, blank()])} className="mt-3 text-sm font-bold text-blue-600">+ Thêm bài tập</button>}
    {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    <div className="mt-6 flex justify-end gap-3"><Button secondary onClick={onClose}>Hủy</Button><Button disabled={busy} onClick={submit}>{busy ? "Đang lưu..." : "Hoàn thành buổi tập"}</Button></div>
  </Card></div>;
}
