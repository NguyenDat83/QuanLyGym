import { useState } from "react";
import type { Page } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { Button, Card, EmptyState, Icon, PageTitle } from "../../components/ui";
import { selection } from "../../lib/selection";

export function Workout({ setPage }: { setPage: (p: Page) => void }) {
  const plansApi = useApi<any[]>("/plans/mine");
  const trainersApi = useApi<any[]>("/trainers");
  const [done, setDone] = useState<number[]>([]);
  const plan = plansApi.data?.[0];
  const week = plan?.weeks?.[plan.weeks.length - 1];
  const day = week?.days?.find((x: any) => x.day === selection.selectedPlanDay) ?? week?.days?.find((x: any) => x.exercises?.length);
  const ex: any[] = day?.exercises ?? [];
  const trainer = (trainersApi.data ?? []).find((t) => t._id === plan?.trainerId);
  return <><button onClick={()=>setPage("plans")} className="mb-5 text-sm font-semibold text-slate-500">← Kế hoạch tập luyện</button><PageTitle title={day?.title || day?.day || "Bài tập"} desc={plan?.goal ?? "Giáo án cá nhân"}/><LoadState error={plansApi.error} loading={plansApi.loading}/>
    {!plansApi.loading&&ex.length===0&&<Card className="p-6"><EmptyState text="Chưa có bài tập cho ngày này."/></Card>}
    {ex.length>0&&<><Card className="mb-6 flex items-center justify-between p-5">{[["calendar",`Tuần ${week?.week ?? 1} · ${day?.day ?? ""}`,"Giáo án"],["dumbbell",`${ex.length} bài`,"Số bài tập"],["users",trainer?.fullName ?? "Huấn luyện viên","Huấn luyện viên"],["target",`${done.length}/${ex.length} bài`,"Tiến độ"]].map(x=><div key={x[0]} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon name={x[0]}/></span><div><b className="text-sm">{x[1]}</b><p className="text-[10px] text-slate-500">{x[2]}</p></div></div>)}</Card><div className="space-y-3">{ex.map((x,i)=><Card key={`${x.name}-${i}`} className={`flex items-center gap-5 p-4 ${done.includes(i)?"border-green-200 bg-green-50/30":""}`}><div className="grid h-16 w-20 place-items-center rounded-xl bg-slate-900 text-blue-400"><Icon name="dumbbell" size={28}/></div><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-bold">{i+1}</span><div className="flex-1"><h3 className="font-bold">{x.name}</h3><p className="mt-1 text-xs text-slate-500">{x.sets} hiệp × {x.reps} lần · Nghỉ {x.restSeconds} giây</p></div><label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500"><input type="checkbox" checked={done.includes(i)} onChange={()=>setDone(done.includes(i)?done.filter(n=>n!==i):[...done,i])} className="h-5 w-5 accent-green-500"/> Hoàn thành</label></Card>)}</div><div className="mt-6 text-right"><Button onClick={()=>setPage("progress")} disabled={done.length<ex.length}>Hoàn thành buổi tập</Button>{done.length<ex.length&&<p className="mt-2 text-xs text-slate-400">Hoàn thành tất cả bài tập để tiếp tục</p>}</div></>}</>;
}
