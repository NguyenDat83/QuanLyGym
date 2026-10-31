import { useState } from "react";
import type { Page } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { Button, Card, EmptyState, Icon, PageTitle } from "../../components/ui";
import { photoOf } from "../../lib/assets";
import { selection } from "../../lib/selection";

export function Trainers({ setPage }: { setPage: (p: Page) => void }) {
  const { data, error, loading } = useApi<any[]>("/trainers");
  const [q, setQ] = useState("");
  const list = (data ?? []).filter((t) => `${t.fullName} ${t.expertise ?? ""} ${t.code}`.toLowerCase().includes(q.toLowerCase()));
  return <><PageTitle title="Huấn luyện viên cá nhân" desc="Khám phá đội ngũ chuyên gia tận tâm tại GYM PRO."/><LoadState error={error} loading={loading}/><div className="mb-6 flex gap-3"><div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4"><Icon name="search" size={17}/><input value={q} onChange={e=>setQ(e.target.value)} className="w-full py-3 text-sm outline-none" placeholder="Tìm huấn luyện viên..."/></div></div>
    {!loading&&list.length===0&&<Card className="p-6"><EmptyState text="Không tìm thấy huấn luyện viên."/></Card>}
    <div className="grid grid-cols-3 gap-5">{list.map((t)=><Card key={t._id} className="overflow-hidden"><div className="relative"><img src={photoOf(t._id)} className="h-52 w-full object-cover object-top" alt={t.fullName}/><span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-green-600">● Đang nhận lịch</span></div><div className="p-5"><h3 className="font-bold">{t.fullName}</h3><p className="mt-1 text-xs font-semibold text-blue-600">{t.expertise ?? "Huấn luyện viên cá nhân"}</p><div className="my-4 flex gap-5 text-xs text-slate-500"><span>{t.experienceYears!=null?`${t.experienceYears} năm kinh nghiệm`:"Huấn luyện viên GYM PRO"}</span><span>Mã {t.code}</span></div><p className="text-xs leading-5 text-slate-500">{t.bio || "Chuyên gia xây dựng lộ trình tập luyện khoa học, an toàn và phù hợp từng thể trạng."}</p><div className="mt-5 flex gap-2"><Button secondary onClick={()=>{selection.selectedTrainerId=t._id;setPage("trainer-detail")}} className="flex-1 py-2.5">Xem hồ sơ</Button><Button onClick={()=>{selection.bookingPresetTrainer=t._id;setPage("booking")}} className="flex-1 py-2.5">Đặt lịch</Button></div></div></Card>)}</div></>;
}
