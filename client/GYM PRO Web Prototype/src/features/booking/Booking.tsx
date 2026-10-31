import { useState, useRef } from "react";
import { api } from "../../api";
import type { BookingDetails, Member, Page } from "../../types";
import { addKeyDays, keyToVi, newRequestId, vnDateKey, vnTime, vnWeekday } from "../../lib/format";
import { defaultBooking } from "./defaultBooking";
import { LoadState, useApi } from "../../lib/useApi";
import { Button, Card, Icon, PageTitle } from "../../components/ui";
import { photoOf } from "../../lib/assets";
import { selection } from "../../lib/selection";

export const workoutTypes = [
  ["dumbbell","Tập sức mạnh","Phát triển sức mạnh toàn thân","60 phút","Trung bình"],
  ["flame","Cardio","Cải thiện tim mạch và sức bền","45 phút","Dễ"],
  ["target","Giảm cân","Đốt mỡ với cường độ cao","50 phút","Khó"],
  ["trophy","Tăng cơ","Xây dựng cơ bắp hiệu quả","60 phút","Trung bình"],
  ["grid","Toàn thân","Tác động mọi nhóm cơ","55 phút","Trung bình"],
  ["users","Tập cùng HLV","Lộ trình cá nhân hóa 1:1","60 phút","Tùy chỉnh"],
];

export function Booking({ setPage, onConfirm, member, initialStep = 1 }: { setPage: (p: Page) => void; onConfirm: (booking: BookingDetails) => void; member: Member; initialStep?: number }) {
  const todayKey = vnDateKey(new Date());
  const dayKeys = [0, 1, 2, 3, 4, 5, 6].map((i) => addKeyDays(todayKey, i));
  const [step, setStep] = useState(initialStep);
  const [type, setType] = useState(defaultBooking.type);
  const [dayKey, setDayKey] = useState(dayKeys[0]);
  const [time, setTime] = useState("");
  const [trainerId, setTrainerId] = useState<string>(selection.bookingPresetTrainer ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(newRequestId()).current; // giữ nguyên khi bấm lại -> server chống đặt trùng
  const slotsApi = useApi<any[]>(`/schedules?date=${dayKey}`);
  const trainersApi = useApi<any[]>("/trainers");
  const meApi = useApi<any>("/members/me"); // quyền lợi gói mới nhất (không dùng dữ liệu cũ trong bộ nhớ)
  const mineApi = useApi<any[]>("/appointments?status=Confirmed"); // để chặn giờ trùng lịch của chính hội viên
  const me = meApi.data;
  const entitled = !me || (me.planStatus === "Còn hiệu lực" && (me.remainingPt ?? 0) > 0);
  const noEntitlementMsg = !me ? "" : me.planStatus === "Chưa đăng ký" ? "Bạn chưa đăng ký gói hội viên nên chưa thể đặt lịch PT." : me.planStatus !== "Còn hiệu lực" ? "Gói hội viên của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục đặt lịch PT." : (me.remainingPt ?? 0) <= 0 ? "Bạn đã dùng hết buổi PT trong gói hiện tại." : "";
  const slots = slotsApi.data ?? [];
  const trainerInfo = new Map((trainersApi.data ?? []).map((t): [string, any] => [t._id, t]));
  const times = Array.from(new Set(slots.map((s) => vnTime(s.startAt)))).sort();
  const clashesMine = (t: string) => {
    const s = slots.find((x) => vnTime(x.startAt) === t);
    return !!s && (mineApi.data ?? []).some((a) => new Date(a.startAt) < new Date(s.endAt) && new Date(a.endAt) > new Date(s.startAt));
  };
  const freeAt = (t: string) => slots.filter((s) => vnTime(s.startAt) === t && s.bookedSlots === 0 && s.trainerId && s.trainerId.isActive !== false);
  const candidates = (time ? freeAt(time) : []).sort((a, b) => Number(b.trainerId._id === selection.bookingPresetTrainer) - Number(a.trainerId._id === selection.bookingPresetTrainer));
  const pickTime = (t: string) => {
    setTime(t);
    setTrainerId(freeAt(t).some((s) => s.trainerId._id === selection.bookingPresetTrainer) ? (selection.bookingPresetTrainer as string) : "");
  };
  const chosen = candidates.find((s) => s.trainerId._id === trainerId);
  const trainerName = chosen?.trainerId?.fullName ?? "";
  const canNext = step === 2 ? !!time && !clashesMine(time) : step === 3 ? !!chosen : true;

  const next = async () => {
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    if (!chosen) {
      setError("Khung giờ này vừa được đặt, vui lòng chọn lại.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/appointments", { scheduleId: chosen._id, requestId, note: type });
      onConfirm({ type, day: `${vnWeekday(dayKey)} ${dayKey.slice(8, 10)}`, dateText: `${vnWeekday(dayKey)}, ${keyToVi(dayKey)}`, time, trainer: trainerName, code: String(r.appointment._id).slice(-8).toUpperCase() });
      selection.bookingPresetTrainer = null;
      setPage("success");
    } catch (e: any) {
      const code = e?.code as string | undefined;
      setBusy(false);
      if (code === "SLOT_TAKEN" || code === "SLOT_CLOSED" || code === "SLOT_PAST") {
        // Người khác vừa đặt trước: tải lại slot và quay về bước chọn giờ
        setTime("");
        setTrainerId("");
        setStep(2);
        slotsApi.reload();
        setError("Khung giờ này vừa được người khác đặt hoặc đã đóng. Vui lòng chọn khung giờ khác.");
      } else {
        if (code === "NO_ENTITLEMENT" || code === "OVERLAP") meApi.reload(), mineApi.reload();
        setError(e?.message || "Không đặt được lịch, vui lòng thử lại.");
      }
    }
  };
  return <><PageTitle title="Đặt lịch tập" desc="Lựa chọn bài tập, ngày, giờ và huấn luyện viên phù hợp."/>
    <Card className="mb-6 px-8 py-5"><div className="flex items-center">{["Chọn bài tập","Ngày & giờ","Huấn luyện viên","Xác nhận"].map((x,i)=><div key={x} className="flex flex-1 items-center last:flex-none"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${step>i+1?"bg-green-500 text-white":step===i+1?"bg-blue-600 text-white":"bg-slate-100 text-slate-400"}`}>{step>i+1?<Icon name="check" size={17}/>:i+1}</span><span className={`text-sm font-semibold ${step===i+1?"text-blue-600":"text-slate-500"}`}>{x}</span></div>{i<3&&<div className={`mx-5 h-px flex-1 ${step>i+1?"bg-green-400":"bg-slate-200"}`}/>}</div>)}</div></Card>
    {!entitled&&<div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><span>{noEntitlementMsg}</span><button onClick={()=>setPage("membership")} className="shrink-0 font-semibold text-blue-600">Xem gói hội viên →</button></div>}
    {entitled&&me&&<div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">Gói <b>{me.planName}</b> · còn <b>{me.remainingPt}</b> buổi PT. Hủy trước giờ tập ít nhất 2 tiếng sẽ được hoàn lại buổi PT.</div>}
    {step!==4&&error&&<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <Card className="p-6">
      {step===1&&<><h2 className="text-lg font-bold">Bạn muốn tập luyện gì?</h2><p className="mt-1 text-sm text-slate-500">Chọn một loại hình phù hợp với mục tiêu của bạn.</p><div className="mt-6 grid grid-cols-3 gap-4">{workoutTypes.map(([i,n,d,t,l])=><button key={n} onClick={()=>setType(n)} className={`relative rounded-2xl border p-5 text-left transition ${type===n?"border-blue-500 bg-blue-50/60 ring-1 ring-blue-500":"border-slate-200 hover:border-blue-300"}`}>{type===n&&<span className="absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white"><Icon name="check" size={13}/></span>}<span className={`grid h-11 w-11 place-items-center rounded-xl ${type===n?"bg-blue-600 text-white":"bg-slate-100 text-slate-600"}`}><Icon name={i}/></span><h3 className="mt-4 font-bold">{n}</h3><p className="mt-1 text-xs text-slate-500">{d}</p><div className="mt-4 flex gap-4 text-[11px] font-medium text-slate-500"><span>{t}</span><span>· {l}</span></div></button>)}</div></>}
      {step===2&&<><h2 className="text-lg font-bold">Chọn ngày và giờ tập</h2><p className="mt-1 text-sm text-slate-500">Các khung giờ mờ hiện không còn chỗ trống.</p><div className="mt-6 grid grid-cols-7 gap-3">{dayKeys.map(k=><button key={k} onClick={()=>{setDayKey(k);setTime("");setTrainerId("");setError("")}} className={`rounded-xl border py-4 ${dayKey===k?"border-blue-600 bg-blue-600 text-white shadow-md":"border-slate-200 hover:border-blue-300"}`}><span className="block text-xs">{vnWeekday(k)}</span><b className="mt-1 block text-xl">{k.slice(8,10)}</b></button>)}</div><h3 className="mt-8 font-semibold">Khung giờ có sẵn</h3><LoadState error={slotsApi.error} loading={slotsApi.loading}/>{!slotsApi.loading&&times.length===0&&<p className="mt-4 text-sm text-slate-400">Ngày này chưa có lịch làm việc của huấn luyện viên.</p>}<div className="mt-4 grid grid-cols-5 gap-3">{times.map(x=>{const mine=clashesMine(x);const full=freeAt(x).length===0;const off=full||mine;return <button key={x} disabled={off} onClick={()=>{setError("");pickTime(x)}} className={`rounded-xl border py-3 text-sm font-semibold ${time===x?"border-blue-600 bg-blue-600 text-white": off?"border-slate-100 bg-slate-100 text-slate-300":"border-slate-200 hover:border-blue-400"}`}>{x}{mine?<span className="block text-[9px] font-normal">Trùng lịch của bạn</span>:full&&<span className="block text-[9px] font-normal">Đã đặt</span>}</button>})}</div></>}
      {step===3&&<><h2 className="text-lg font-bold">Chọn huấn luyện viên</h2><p className="mt-1 text-sm text-slate-500">Các huấn luyện viên còn trống lúc {time} ngày {keyToVi(dayKey)}.</p><div className="mt-6 grid grid-cols-3 gap-4">{candidates.map((s)=>{const t=trainerInfo.get(s.trainerId._id);const id=s.trainerId._id as string;return <div key={id} onClick={()=>setTrainerId(id)} className={`cursor-pointer overflow-hidden rounded-2xl border ${trainerId===id?"border-blue-500 ring-1 ring-blue-500":"border-slate-200"}`}><img src={photoOf(id)} className="h-36 w-full object-cover object-top" alt={s.trainerId.fullName}/><div className="p-4"><h3 className="font-bold">{s.trainerId.fullName}</h3><p className="mt-1 text-xs text-blue-600">{t?.expertise ?? ""}</p><p className="mt-2 text-xs text-slate-500">Kinh nghiệm: {t?.experienceYears!=null?`${t.experienceYears} năm`:"—"}</p><div className="mt-4 flex items-center justify-between"><span className="text-xs font-semibold text-green-600">● Còn lịch{id===selection.bookingPresetTrainer?" · HLV bạn chọn":""}</span><button className={`rounded-lg px-4 py-2 text-xs font-semibold ${trainerId===id?"bg-blue-600 text-white":"bg-slate-100"}`}>{trainerId===id?"Đã chọn":"Chọn"}</button></div></div></div>})}{candidates.length===0&&<p className="col-span-3 text-sm text-slate-400">Chưa có huấn luyện viên trống ở khung giờ này. Hãy quay lại chọn giờ khác.</p>}</div></>}
      {step===4&&<><div className="mx-auto max-w-2xl"><div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-blue-600"><Icon name="calendar" size={26}/></span><h2 className="mt-4 text-xl font-bold">Thông tin đặt lịch</h2><p className="mt-1 text-sm text-slate-500">Vui lòng kiểm tra thông tin trước khi xác nhận.</p></div>{error&&<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="mt-6 rounded-2xl bg-slate-50 p-6">{[["Loại bài tập",type],["Ngày",`${vnWeekday(dayKey)}, ${keyToVi(dayKey)}`],["Giờ",time],["Huấn luyện viên",trainerName],["Thời lượng","60 phút"],["Gói hội viên",me?.planName??member.plan],["Buổi PT còn lại",me?`${me.remainingPt} (còn ${Math.max((me.remainingPt??0)-1,0)} sau khi đặt)`:"—"]].map(x=><div key={x[0]} className="flex justify-between border-b border-slate-200 py-3 last:border-0"><span className="text-sm text-slate-500">{x[0]}</span><b className="text-sm">{x[1]}</b></div>)}</div></div></>}
      <div className="mt-7 flex justify-between border-t border-slate-100 pt-5"><Button secondary disabled={step===1||busy} onClick={()=>{setError("");setStep(step-1)}}>Quay lại</Button><Button disabled={!canNext||busy||(step===4&&!entitled)} onClick={next}>{busy?"Đang đặt lịch...":step===4?"Xác nhận đặt lịch":"Tiếp tục"} <span className="ml-2">→</span></Button></div>
    </Card>
  </>;
}
