import { useState } from "react";
import { api } from "../../api";
import type { ApiAppt, Page } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { addKeyDays, keyToVi, vnDateKey, vnTime, vnWeekday } from "../../lib/format";
import { Button, Card, EmptyState, Icon, PageTitle } from "../../components/ui";
import { APPT_LABEL } from "../../lib/labels";

export function Schedule({ setPage }: { setPage: (p: Page) => void }) {
  const { data, error, loading, reload } = useApi<ApiAppt[]>("/appointments");
  const items = data ?? [];
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("Thay đổi lịch cá nhân");
  const [msg, setMsg] = useState("");
  const [cancelErr, setCancelErr] = useState("");
  const [busy, setBusy] = useState(false);
  const todayKey = vnDateKey(new Date());
  const dow = new Date(todayKey + "T00:00:00Z").getUTCDay();
  const monday = addKeyDays(todayKey, -((dow + 6) % 7) + weekOffset * 7);
  const weekKeys = [0, 1, 2, 3, 4, 5, 6].map((i) => addKeyDays(monday, i));
  const visible = items.filter((a) => filter === "all" || a.status === filter);
  const sel = items.find((a) => a._id === selId) ?? items.find((a) => ["Pending", "Confirmed"].includes(a.status) && new Date(a.endAt).getTime() > Date.now()) ?? items[0];
  const canCancel = !!sel && ["Pending", "Confirmed"].includes(sel.status) && new Date(sel.startAt).getTime() > Date.now();
  const evColor = (s: string) => s === "Pending" ? "bg-orange-50 border-orange-200 text-orange-700" : s === "Rejected" ? "bg-red-50 border-red-200 text-red-600 opacity-60 line-through" : s === "Confirmed" ? "bg-blue-50 border-blue-200 text-blue-700" : s === "Cancelled" ? "bg-red-50 border-red-200 text-red-600 opacity-60 line-through" : s === "NoShow" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-green-50 border-green-200 text-green-700";
  const cancel = async () => {
    if (!sel) return;
    setBusy(true);
    setCancelErr("");
    try {
      const r = await api.post(`/appointments/${sel._id}/cancel`, { reason });
      setShowCancel(false);
      setMsg(r.refunded ? "Lịch hẹn đã được hủy. Buổi PT đã được hoàn lại vào quyền lợi gói của bạn." : "Lịch hẹn đã được hủy.");
      reload();
    } catch (e: any) {
      setCancelErr(e?.message || "Không hủy được lịch hẹn");
    }
    setBusy(false);
  };
  const head = <PageTitle title="Lịch tập của tôi" desc="Theo dõi, check-in và quản lý các buổi tập với huấn luyện viên." action={<div className="flex gap-2"><Button secondary onClick={()=>setPage("support")}><Icon name="help" size={16}/> Liên hệ Admin</Button><Button onClick={()=>setPage("booking")}>+ Đặt lịch mới</Button></div>}/>;
  if (!loading && !error && items.length === 0) return <>{head}<Card className="p-6"><EmptyState text="Chưa có lịch tập nào. Hãy đặt lịch đầu tiên của bạn."/></Card></>;
  const selKey = sel ? vnDateKey(sel.startAt) : "";
  const selLabel = sel ? APPT_LABEL[sel.status] : null;
  return <>{head}
    <LoadState error={error} loading={loading}/>
    {msg&&<div className="mb-4 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"><span>{msg}</span><button onClick={()=>setMsg("")}><Icon name="x" size={15}/></button></div>}
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <Card className="p-5"><div className="flex items-center justify-between"><div className="flex rounded-xl bg-slate-100 p-1">{["Ngày","Tuần","Tháng"].map(x=><button key={x} className={`rounded-lg px-5 py-2 text-xs font-semibold ${x==="Tuần"?"bg-white text-blue-600 shadow-sm":"text-slate-500"}`}>{x}</button>)}</div><div className="flex items-center gap-4"><button aria-label="Tuần trước" onClick={()=>setWeekOffset(weekOffset-1)}>‹</button><b className="text-sm">{keyToVi(weekKeys[0]).slice(0,5)} — {keyToVi(weekKeys[6])}</b><button aria-label="Tuần sau" onClick={()=>setWeekOffset(weekOffset+1)}>›</button></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="all">Tất cả trạng thái</option><option value="Pending">Chờ HLV xác nhận</option><option value="Confirmed">Sắp tới</option><option value="CheckedIn">Đã check-in</option><option value="Completed">Hoàn thành</option><option value="Cancelled">Đã hủy</option><option value="NoShow">Không đến</option></select></div>
        <div className="mt-6 grid grid-cols-7 border-l border-t border-slate-200">{weekKeys.map((k,i)=><div className="min-h-96 border-b border-r border-slate-200" key={k}><div className="border-b border-slate-100 py-3 text-center"><p className="text-[10px] text-slate-500">{["T2","T3","T4","T5","T6","T7","CN"][i]}</p><b className={`${k===todayKey?"mt-1 inline-grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-white":""}`}>{k.slice(8,10)}</b></div>{visible.filter(a=>vnDateKey(a.startAt)===k).map(a=><button key={a._id} onClick={()=>setSelId(a._id)} className={`m-2 block w-[calc(100%-1rem)] rounded-lg border p-3 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-md ${evColor(a.status)} ${sel?._id===a._id?"ring-2 ring-blue-400":""}`}><b>{vnTime(a.startAt)}</b><p className="mt-1 font-semibold">{a.note || "Buổi tập PT"}</p><p className="mt-2 opacity-70">60 phút · {a.trainerId?.fullName ?? "PT 1:1"}</p></button>)}</div>)}</div>
      </Card>
      {sel&&<Card className="h-fit overflow-hidden"><div className="bg-slate-900 p-5 text-white"><p className="text-xs font-semibold text-blue-300">LỊCH HẸN PT · {sel._id.slice(-8).toUpperCase()}</p><h2 className="mt-2 text-lg font-bold">{sel.note || "Buổi tập PT"}</h2></div><div className="p-5">{selLabel&&<span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selLabel[1]}`}>{selLabel[0]}</span>}<div className="mt-5 space-y-4">{[["calendar",`${vnWeekday(selKey)}, ${keyToVi(selKey)}`],["clock",`${vnTime(sel.startAt)} — ${vnTime(sel.endAt)}`],["users",`PT ${sel.trainerId?.fullName ?? "—"}`],["map","Khu PT cá nhân"]].map(x=><div key={x[0]} className="flex items-center gap-3 text-sm"><span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><Icon name={x[0]} size={17}/></span><span className="font-medium text-slate-700">{x[1]}</span></div>)}</div>
        {sel.status==="Pending"&&<div className="mt-5 rounded-xl bg-orange-50 p-4 text-xs leading-5 text-orange-700"><b className="block">Đang chờ HLV xác nhận</b>Buổi PT đã được giữ chỗ. Nếu HLV từ chối, bạn sẽ được hoàn lại buổi PT.</div>}{sel.status==="Confirmed"&&<div className="mt-5 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-700"><b className="block">Nhớ check-in khi đến phòng tập</b>Vui lòng có mặt trước giờ tập 10 phút và mang theo khăn tập. Lễ tân sẽ xác nhận check-in cho bạn.</div>}
        {canCancel&&<Button secondary onClick={()=>{setCancelErr("");setShowCancel(true)}} className="mt-4 w-full text-red-500 hover:border-red-200 hover:text-red-600">Hủy lịch hẹn</Button>}
        {sel.status==="CheckedIn"&&<div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-5 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-500 text-white"><Icon name="check" size={25}/></span><b className="mt-3 block text-sm text-green-700">Đã check-in</b><p className="mt-1 text-xs leading-5 text-green-600">Quầy lễ tân đã xác nhận bạn có mặt.</p></div>}
        {sel.status==="Cancelled"&&<><div className="mt-5 rounded-xl bg-red-50 p-4 text-xs leading-5 text-red-600">Lịch hẹn đã được hủy.{sel.refunded?" Buổi PT đã được hoàn lại vào quyền lợi gói.":""}</div><Button onClick={()=>setPage("booking")} className="mt-4 w-full">Đặt lại lịch PT</Button></>}
      </div></Card>}
    </div>
    {showCancel&&sel&&<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6"><Card className="w-full max-w-md p-6 shadow-2xl"><div className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500"><Icon name="calendar" size={22}/></div><h2 className="mt-4 text-xl font-bold">Hủy lịch hẹn PT?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Bạn sắp hủy buổi <b className="text-slate-700">{sel.note || "tập PT"}</b> lúc {vnTime(sel.startAt)}, ngày {keyToVi(selKey)} với PT {sel.trainerId?.fullName ?? "—"}. Hủy trước giờ tập ít nhất 2 giờ sẽ được hoàn lại buổi PT.</p>{cancelErr&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{cancelErr}</div>}<label className="mt-5 block text-sm font-semibold text-slate-700">Lý do hủy<select value={reason} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-blue-500"><option>Thay đổi lịch cá nhân</option><option>Không khỏe</option><option>Muốn đổi huấn luyện viên</option><option>Lý do khác</option></select></label><div className="mt-6 flex justify-end gap-3"><Button secondary onClick={()=>setShowCancel(false)}>Giữ lịch</Button><Button danger disabled={busy} onClick={cancel}>{busy?"Đang hủy...":"Xác nhận hủy"}</Button></div></Card></div>}
  </>;
}
