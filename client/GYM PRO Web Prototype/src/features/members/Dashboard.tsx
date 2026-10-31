import type { ApiAppt, Member, Page } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { addKeyDays, vnDateKey, vnTime } from "../../lib/format";
import { APPT_LABEL } from "../../lib/labels";
import { Button, Card, EmptyState, Icon, PageTitle } from "../../components/ui";

// ngày tập đang xem trong giáo án
export function Dashboard({ setPage, member }: { setPage: (p: Page) => void; member: Member }) {
  const { data, error, loading } = useApi<ApiAppt[]>("/appointments");
  const list = data ?? [];
  const todayKey = vnDateKey(new Date());
  const upcoming = list.filter((a) => a.status === "Confirmed" && new Date(a.endAt).getTime() > Date.now());
  const todayList = list.filter((a) => vnDateKey(a.startAt) === todayKey && ["Confirmed", "CheckedIn", "Completed"].includes(a.status));
  const checkinsToday = todayList.filter((a) => a.status !== "Confirmed").length;
  const nextToday = todayList[0];
  const dow = new Date(todayKey + "T00:00:00Z").getUTCDay();
  const monday = addKeyDays(todayKey, -((dow + 6) % 7));
  const barHeights = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const key = addKeyDays(monday, i);
    const minutes = list.filter((a) => vnDateKey(a.startAt) === key && ["CheckedIn", "Completed"].includes(a.status)).length * 60;
    return Math.max(4, Math.min(100, (minutes / 120) * 100));
  });
  const stats = [
    ["card", "Gói hội viên", member.plan, member.planStatus, "blue"],
    ["calendar", "Buổi tập sắp tới", `${upcoming.length} buổi`, upcoming.length ? "Đã xác nhận" : "Chưa có lịch", "green"],
    ["flame", "Lượt check-in hôm nay", String(checkinsToday), checkinsToday ? "Đã ghi nhận" : "Chưa check-in", "orange"],
    ["trophy", "Mục tiêu", member.goal || "Chưa đặt", typeof member.remainingPt === "number" ? `Còn ${member.remainingPt} buổi PT` : "Kế hoạch cá nhân", "violet"],
  ];
  const label = nextToday ? APPT_LABEL[nextToday.status] : null;
  return <><PageTitle title={`Xin chào, ${member.name}!`} desc="Sẵn sàng cho buổi tập hôm nay?"/>
    <LoadState error={error} loading={loading}/>
    <div className="grid grid-cols-4 gap-4">{stats.map(([icon, lb, value, sub, color]) => <Card key={lb} className="p-5"><div className={`mb-4 grid h-10 w-10 place-items-center rounded-xl bg-${color}-50 text-${color}-600`}><Icon name={icon}/></div><p className="text-xs font-medium text-slate-500">{lb}</p><p className="mt-1 text-xl font-bold">{value}</p><p className={`mt-1 text-xs text-${color}-600`}>{sub}</p></Card>)}</div>
    <div className="mt-6 grid grid-cols-[1.35fr_.85fr] gap-6">
      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><h2 className="font-bold">Buổi tập hôm nay</h2>{label&&<span className={`rounded-full px-3 py-1 text-xs font-semibold ${label[1]}`}>{label[0]}</span>}</div>
        {nextToday?<div className="p-5"><div className="flex gap-5"><div className="grid h-24 w-24 place-items-center rounded-2xl bg-slate-900 text-blue-400"><Icon name="dumbbell" size={38}/></div><div className="flex-1"><h3 className="text-lg font-bold">{nextToday.note || "Buổi tập cá nhân"}</h3><div className="mt-2 flex gap-5 text-xs text-slate-500"><span className="flex gap-1.5"><Icon name="clock" size={15}/>60 phút</span></div><p className="mt-3 text-sm text-slate-600">HLV {nextToday.trainerId?.fullName ?? "—"} · {vnTime(nextToday.startAt)} hôm nay</p></div></div><div className="mt-5 flex justify-end"><Button onClick={() => setPage("plans")} className="py-2.5">Xem giáo án</Button></div></div>
        :<div className="p-5"><EmptyState text="Hôm nay bạn chưa có lịch tập."/><div className="mt-4 text-center"><Button onClick={() => setPage("booking")}>Đặt lịch tập</Button></div></div>}
      </Card>
      <Card className="p-5"><h2 className="font-bold">Thao tác nhanh</h2><div className="mt-4 grid grid-cols-2 gap-3">{[["booking","plus","Đặt lịch tập"],["messages","message","Nhắn tin HLV"],["support","help","Liên hệ Admin"],["progress","chart","Xem tiến độ"]].map(([p,i,l]) => <button onClick={() => setPage(p as Page)} key={l} className="group rounded-xl border border-slate-200 p-4 text-left text-sm font-semibold hover:border-blue-300 hover:bg-blue-50/40"><span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white"><Icon name={i} size={18}/></span>{l}</button>)}</div></Card>
    </div>
    <div className="mt-6 grid grid-cols-[1.35fr_.85fr] gap-6">
      <Card className="p-5"><div className="flex justify-between"><h2 className="font-bold">Thống kê tập luyện trong tuần</h2><span className="text-xs text-slate-500">Số phút tập luyện</span></div><div className="mt-6 flex h-40 items-end justify-between gap-5 border-b border-slate-100 px-3">{barHeights.map((h,i)=><div key={i} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-blue-100 hover:bg-blue-600" style={{height:`${h}%`}}/><span className="text-[11px] text-slate-500">{["T2","T3","T4","T5","T6","T7","CN"][i]}</span></div>)}</div></Card>
      <Card className="p-5"><div className="flex justify-between"><h2 className="font-bold">Lịch tập sắp tới</h2><button onClick={() => setPage("schedule")} className="text-xs font-semibold text-blue-600">Xem tất cả</button></div>
        {upcoming.length===0&&<p className="py-6 text-center text-sm text-slate-400">Chưa có lịch sắp tới.</p>}
        {upcoming.slice(0,4).map(a=>{const k=vnDateKey(a.startAt);return <div key={a._id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"><div className="w-12 rounded-lg bg-slate-100 p-2 text-center text-[10px] font-bold">{k.slice(8,10)} Thg {Number(k.slice(5,7))}</div><div className="flex-1"><p className="text-sm font-semibold">{a.note || "Buổi tập PT"} <span className="font-normal text-slate-400">· {vnTime(a.startAt)}</span></p><p className="text-xs text-slate-500">{a.trainerId?.fullName ?? "—"}</p></div><i className="h-2 w-2 rounded-full bg-green-500"/></div>})}
      </Card>
    </div>
  </>;
}
