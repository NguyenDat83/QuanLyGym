import type { ApiAppt, Page } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { addKeyDays, vnDateKey, vnWeekday } from "../../lib/format";
import { Button, Card, EmptyState, Icon, PageTitle } from "../../components/ui";
import { selection } from "../../lib/selection";

export type PlanDay = [string, string, string, string, boolean];

export function Plans({ setPage }: { setPage: (p: Page) => void }) {
  const plansApi = useApi<any[]>("/plans/mine");
  const apptApi = useApi<ApiAppt[]>("/appointments");
  const plan = plansApi.data?.[0];
  const week = plan?.weeks?.[plan.weeks.length - 1];
  const todayKey = vnDateKey(new Date());
  const todayName = vnWeekday(todayKey);
  const names = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
  const days: PlanDay[] = names.map((n) => {
    const d = week?.days?.find((x: any) => x.day === n);
    return d && d.exercises?.length ? [n, d.title || "Buổi tập", `${d.exercises.length} bài tập`, n === todayName ? "Hôm nay" : "Có lịch", true] : [n, "Nghỉ ngơi", "Phục hồi cơ thể", "Nghỉ", false];
  });
  const dow = new Date(todayKey + "T00:00:00Z").getUTCDay();
  const monday = addKeyDays(todayKey, -((dow + 6) % 7));
  const inWeek = (apptApi.data ?? []).filter((a) => a.status !== "Cancelled" && vnDateKey(a.startAt) >= monday && vnDateKey(a.startAt) <= addKeyDays(monday, 6));
  const done = inWeek.filter((a) => ["CheckedIn", "Completed"].includes(a.status)).length;
  const pct = inWeek.length ? Math.round((done / inWeek.length) * 100) : 0;
  return <><PageTitle title="Kế hoạch tập luyện của tôi" desc={plan ? `Tuần ${week?.week ?? 1} · Mục tiêu ${plan.goal ?? "tập luyện cá nhân"}` : "Giáo án do huấn luyện viên xây dựng cho bạn"}/>
    <LoadState error={plansApi.error} loading={plansApi.loading}/>
    {!plansApi.loading&&!plan&&<Card className="mb-6 p-6"><EmptyState text="Huấn luyện viên chưa xuất bản giáo án cho bạn."/></Card>}
    <div className="grid grid-cols-[1fr_280px] gap-6"><Card className="p-5"><div className="grid grid-cols-7 gap-3">{days.map((x,i)=><button key={x[0]} onClick={()=>{if(x[4]){selection.selectedPlanDay=x[0];setPage("workout")}}} className={`min-h-64 rounded-xl border p-4 text-left ${x[3]==="Hôm nay"?"border-blue-500 bg-blue-50":"border-slate-200 hover:border-blue-300"} ${x[3]==="Nghỉ"?"bg-slate-50":""}`}><span className="text-xs font-semibold text-slate-500">{x[0]}</span><div className={`mt-8 grid h-10 w-10 place-items-center rounded-lg ${x[3]==="Nghỉ"?"bg-slate-200 text-slate-400":"bg-blue-600 text-white"}`}><Icon name={x[3]==="Nghỉ"?"clock":"dumbbell"} size={18}/></div><h3 className="mt-4 text-sm font-bold">{x[1]}</h3><p className="mt-1 text-[11px] text-slate-500">{x[2]}</p><span className={`mt-6 inline-block rounded-full px-2 py-1 text-[9px] font-bold ${x[3]==="Hôm nay"?"bg-blue-600 text-white":"bg-slate-100 text-slate-500"}`}>{x[3]}</span></button>)}</div></Card>
      <Card className="p-6"><h2 className="font-bold">Tổng kết tuần</h2><div className="mx-auto mt-6 grid h-36 w-36 place-items-center rounded-full" style={{background:`conic-gradient(#2563eb 0 ${pct}%, #e2e8f0 ${pct}% 100%)`}}><div className="grid h-28 w-28 place-items-center rounded-full bg-white"><div className="text-center"><b className="text-2xl">{pct}%</b><p className="text-[10px] text-slate-500">Hoàn thành</p></div></div></div>{[["Lịch trong tuần",`${inWeek.length} buổi`],["Đã hoàn thành",`${done} buổi`],["Còn lại",`${inWeek.length-done} buổi`]].map(x=><div key={x[0]} className="mt-4 flex justify-between text-sm"><span className="text-slate-500">{x[0]}</span><b>{x[1]}</b></div>)}<Button onClick={()=>{const first=days.find(d=>d[4]);if(first){selection.selectedPlanDay=first[0];setPage("workout")}}} disabled={!days.some(d=>d[4])} className="mt-6 w-full py-2.5">Xem bài tập</Button></Card></div></>;
}
