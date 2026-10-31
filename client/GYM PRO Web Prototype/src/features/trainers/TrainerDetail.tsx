import type { Page } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { Button, Card, EmptyState } from "../../components/ui";
import { keyToVi, vnDateKey, vnTime, vnWeekday } from "../../lib/format";
import { photoOf } from "../../lib/assets";
import { selection } from "../../lib/selection";

export function TrainerDetail({ setPage }: { setPage: (p: Page) => void }) {
  const tApi = useApi<any>(selection.selectedTrainerId ? `/trainers/${selection.selectedTrainerId}` : null);
  const sApi = useApi<any[]>(selection.selectedTrainerId ? `/schedules?trainerId=${selection.selectedTrainerId}&status=available` : null);
  const back = <button onClick={()=>setPage("trainers")} className="mb-5 text-sm font-semibold text-slate-500">← Quay lại danh sách</button>;
  if (!selection.selectedTrainerId) return <>{back}<Card className="p-6"><EmptyState text="Chưa chọn huấn luyện viên."/></Card></>;
  const t = tApi.data;
  if (!t) return <>{back}<LoadState error={tApi.error} loading={tApi.loading}/></>;
  const byDay: Record<string, string[]> = {};
  (sApi.data ?? []).forEach((s) => {
    const k = vnDateKey(s.startAt);
    if (!byDay[k]) byDay[k] = [];
    byDay[k].push(vnTime(s.startAt));
  });
  const dayKeys = Object.keys(byDay).sort().slice(0, 7);
  const pkgs: any[] = (t.packageIds ?? []).filter((p: any) => p && p.name);
  return <>{back}<Card className="overflow-hidden"><div className="grid grid-cols-[320px_1fr]"><img src={photoOf(t._id)} className="h-full min-h-80 w-full object-cover" alt={t.fullName}/><div className="p-8"><span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">● Đang nhận lịch</span><h1 className="mt-4 text-3xl font-bold">{t.fullName}</h1><p className="mt-1 font-semibold text-blue-600">{t.expertise ?? "Huấn luyện viên cá nhân"}</p><div className="mt-5 flex gap-8 text-sm"><b>{t.experienceYears!=null?`${t.experienceYears} năm`:"—"} <span className="font-normal text-slate-400">kinh nghiệm</span></b><b>{t.code} <span className="font-normal text-slate-400">mã HLV</span></b></div><p className="mt-6 max-w-2xl text-sm leading-6 text-slate-600">{t.bio || "Chuyên gia xây dựng lộ trình tập luyện khoa học, an toàn và phù hợp từng thể trạng."}</p><Button onClick={()=>{selection.bookingPresetTrainer=t._id;setPage("booking")}} className="mt-6">Đặt lịch với huấn luyện viên</Button></div></div></Card>
    <div className="mt-6 grid grid-cols-3 gap-5"><Card className="col-span-2 p-6"><h2 className="font-bold">Lịch trống sắp tới</h2><LoadState error={sApi.error} loading={sApi.loading}/>{!sApi.loading&&dayKeys.length===0&&<p className="mt-4 text-sm text-slate-400">Huấn luyện viên chưa có lịch trống.</p>}<div className="mt-4 space-y-4">{dayKeys.map(k=><div key={k}><p className="text-sm font-semibold">{vnWeekday(k)}, {keyToVi(k)}</p><div className="mt-2 flex flex-wrap gap-2">{byDay[k].map(x=><span key={x} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">{x}</span>)}</div></div>)}</div></Card>
      <Card className="p-6"><h2 className="font-bold">Gói hỗ trợ</h2><div className="mt-4 flex flex-wrap gap-2">{pkgs.length?pkgs.map((p)=><span key={p._id} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold">{p.name}</span>):<span className="text-sm text-slate-400">Tất cả gói</span>}</div></Card></div></>;
}
