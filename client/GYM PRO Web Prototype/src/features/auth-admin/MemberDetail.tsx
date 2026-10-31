import { useState } from "react";
import { api } from "../../api";
import type { Member } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { keyToVi, vnDateKey, vnTime } from "../../lib/format";
import { APPT_LABEL } from "../../lib/labels";
import { fromApiMember } from "../members/memberApi";
import { Button, Card, EmptyState, Icon, StatusPill } from "../../components/ui";
import { MemberEditModal } from "./MemberEditModal";
import { AccountStatusModal } from "./AccountStatusModal";

export function MemberDetail({ member, members, onBack, onUpdate }: { member:Member; members:Member[]; onBack:()=>void; onUpdate:(member:Member)=>void }) {
  const tabs=["Hồ sơ cá nhân","Gói hội viên","Lịch tập","Lịch sử check-in","Kế hoạch & tiến độ","Nhật ký hoạt động"];
  const [tab,setTab]=useState(tabs[0]);
  const [editing,setEditing]=useState(false);
  const [changing,setChanging]=useState(false);
  const [message,setMessage]=useState("");
  const detail=useApi<any>(member._id?`/members/${member._id}`:null);
  const pkgs=useApi<any[]>("/packages");
  const [pkgId,setPkgId]=useState("");
  const [startDate,setStartDate]=useState(vnDateKey(new Date()));
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const subs:any[]=[...(detail.data?.member?.subscriptions??[])].sort((a,b)=>String(b.startDate).localeCompare(String(a.startDate)));
  const appts:any[]=detail.data?.appointments??[];
  const checkins:any[]=detail.data?.checkins??[];
  const sellable=(pkgs.data??[]).filter(p=>p.config?.isActive);
  const dateVi=(d:string)=>keyToVi(vnDateKey(d));
  const register=async()=>{
    if(!member._id||!pkgId){setErr("Vui lòng chọn gói cần đăng ký.");return}
    setBusy(true);setErr("");setMessage("");
    try{
      const r=await api.post(`/members/${member._id}/subscriptions`,{packageId:pkgId,startDate});
      const m=fromApiMember({...r,accountStatus:member.accountStatus});
      onUpdate({...member,plan:m.plan,planStart:m.planStart,planEnd:m.planEnd,planStatus:m.planStatus,remainingPt:m.remainingPt});
      setMessage("Đã đăng ký gói mới cho hội viên.");
      detail.reload();
    }catch(e:any){setErr(e?.message||"Không đăng ký được gói.")}
    setBusy(false);
  };
  const timeline=[
    {at:member.joined,text:"Tạo tài khoản hội viên"},
    ...subs.map(x=>({at:dateVi(x.createdAt??x.startDate),text:`Đăng ký gói ${x.packageName} (${x.totalPt} buổi PT)`})),
    ...checkins.map(x=>({at:`${dateVi(x.checkInTime)} · ${vnTime(x.checkInTime)}`,text:"Check-in tại quầy"})),
  ];
  const profileRows=[["Mã hội viên",member.id],["Họ và tên",member.name],["Email",member.email],["Số điện thoại",member.phone],["Ngày sinh",member.birthDate],["Giới tính",member.gender],["Ngày đăng ký",member.joined],["Trạng thái",member.accountStatus]];
  return <><button onClick={onBack} className="mb-5 text-sm font-semibold text-slate-500">← Quay lại danh sách hội viên</button>{message&&<div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}<Card className="overflow-hidden"><div className="flex items-center gap-5 border-b border-slate-100 p-6"><img src={member.avatar} className="h-20 w-20 rounded-2xl object-cover" alt={member.name}/><div className="flex-1"><div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{member.name}</h1><StatusPill tone={member.accountStatus==="Đang hoạt động"?"green":"red"}>{member.accountStatus}</StatusPill></div><p className="mt-1 text-sm text-slate-500">{member.id} · {member.email} · Vai trò HỘI VIÊN</p><p className="mt-2 text-xs text-blue-600">{member.plan} · {member.planStatus}</p></div><Button secondary onClick={()=>setEditing(true)}><Icon name="edit" size={16}/> Chỉnh sửa</Button><Button danger={member.accountStatus==="Đang hoạt động"} secondary={member.accountStatus==="Đã khóa"} onClick={()=>setChanging(true)}>{member.accountStatus==="Đang hoạt động"?"Khóa tài khoản":"Mở khóa"}</Button></div><div className="flex overflow-x-auto border-b border-slate-100 px-5">{tabs.map(item=><button key={item} onClick={()=>setTab(item)} className={`whitespace-nowrap border-b-2 px-4 py-4 text-xs font-semibold ${tab===item?"border-blue-600 text-blue-600":"border-transparent text-slate-500"}`}>{item}</button>)}</div><div className="p-6">{tab==="Hồ sơ cá nhân"&&<div className="grid grid-cols-2 gap-x-10 gap-y-1">{profileRows.map(row=><div key={row[0]} className="flex justify-between border-b border-slate-100 py-3 text-sm"><span className="text-slate-500">{row[0]}</span><b>{row[1]}</b></div>)}</div>}{tab==="Gói hội viên"&&<>
<LoadState error={detail.error} loading={detail.loading}/>
{member.plan!=="Chưa đăng ký"&&<div className="grid grid-cols-4 gap-4">{[["Tên gói",member.plan],["Ngày bắt đầu",member.planStart],["Ngày hết hạn",member.planEnd],["Trạng thái",member.planStatus]].map(row=><div key={row[0]} className="rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">{row[0]}</span><b className="mt-1 block text-sm">{row[1]}</b></div>)}</div>}
<div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-5"><h3 className="font-bold">Đăng ký / gia hạn gói</h3><p className="mt-1 text-xs text-slate-500">Tạo thêm một gói mới cho hội viên; các gói cũ được giữ nguyên, giá và số buổi PT lưu theo thời điểm đăng ký.</p>
{err&&<div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">{err}</div>}
<div className="mt-4 flex items-end gap-3"><label className="flex-1 text-xs font-semibold text-slate-600">Gói tập<select value={pkgId} onChange={e=>{setPkgId(e.target.value);setErr("")}} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal outline-none"><option value="">— Chọn gói —</option>{sellable.map(p=><option key={p._id} value={p._id}>{p.name} · {p.config.price.toLocaleString("vi-VN")}đ · {p.config.durationDays} ngày · {p.config.ptSessions} buổi PT</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Ngày bắt đầu<input type="date" value={startDate} min={vnDateKey(new Date())} onChange={e=>setStartDate(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal outline-none"/></label><Button disabled={busy||member.accountStatus==="Đã khóa"} onClick={register}>{busy?"Đang lưu...":"Đăng ký gói"}</Button></div>
{member.accountStatus==="Đã khóa"&&<p className="mt-2 text-xs text-orange-600">Tài khoản đang bị khóa nên chưa thể đăng ký gói.</p>}</div>
<h3 className="mt-6 font-bold">Lịch sử gói đã đăng ký</h3>
{subs.length===0?<div className="mt-3"><EmptyState/></div>:<div className="mt-3 space-y-3">{subs.map(x=><div key={x._id} className="flex items-center rounded-xl border border-slate-200 p-4 text-sm"><div className="flex-1"><b>{x.packageName}</b><p className="mt-1 text-xs text-slate-500">{dateVi(x.startDate)} – {dateVi(x.endDate)} · {Number(x.priceSnapshot).toLocaleString("vi-VN")}đ · đã dùng {x.usedPt}/{x.totalPt} buổi PT</p></div><StatusPill tone={x.state==="Còn hiệu lực"?"green":x.state==="Hết hạn"?"red":"slate"}>{x.state}</StatusPill></div>)}</div>}
</>}
{tab==="Lịch tập"&&(appts.length===0?<EmptyState/>:<div className="overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Ngày tập","Giờ","Nội dung","Huấn luyện viên","Trạng thái"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{appts.map(a=>{const [lb,cls]=APPT_LABEL[a.status]??[a.status,"bg-slate-100 text-slate-600"];return <tr key={a._id} className="border-t border-slate-100"><td className="p-3">{dateVi(a.startAt)}</td><td className="p-3">{vnTime(a.startAt)}</td><td className="p-3 font-semibold">{a.note||"Tập luyện cá nhân"}</td><td className="p-3">{a.trainerId?.fullName??"—"}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{lb}</span></td></tr>})}</tbody></table></div>)}
{tab==="Lịch sử check-in"&&(checkins.length===0?<EmptyState/>:<div className="space-y-3">{checkins.map(c=><div key={c._id} className="flex items-center rounded-xl border border-slate-200 p-4 text-sm"><b className="w-40 text-blue-600">{String(c._id).slice(-8).toUpperCase()}</b><span className="flex-1">{dateVi(c.checkInTime)} · {vnTime(c.checkInTime)}</span><StatusPill tone={c.status==="Completed"?"green":"blue"}>{c.status==="Completed"?"Đã tập xong":"Đã check-in"}</StatusPill></div>)}</div>)}
{tab==="Kế hoạch & tiến độ"&&<div className="grid grid-cols-[1fr_1fr] gap-5"><div className="rounded-xl bg-blue-50 p-5"><span className="text-xs text-blue-600">Mục tiêu tập luyện</span><h3 className="mt-2 font-bold">{member.goal||"Chưa cập nhật"}</h3><p className="mt-3 text-xs leading-5 text-blue-700">Giáo án do huấn luyện viên phụ trách soạn và xuất bản.</p></div><div className="rounded-xl bg-slate-50 p-5"><div className="flex justify-between"><span className="text-sm font-semibold">Buổi đã check-in</span><b className="text-blue-600">{checkins.length}</b></div><div className="mt-3 flex justify-between"><span className="text-sm font-semibold">Buổi PT còn lại</span><b className="text-blue-600">{typeof member.remainingPt==="number"?member.remainingPt:"—"}</b></div></div></div>}
{tab==="Nhật ký hoạt động"&&<div className="space-y-3">{timeline.map((row,i)=><div key={i} className="grid grid-cols-[200px_1fr] rounded-xl border border-slate-200 p-4 text-sm"><span className="text-slate-500">{row.at}</span><b>{row.text}</b></div>)}</div>}</div></Card>{editing&&<MemberEditModal member={member} members={members} onClose={()=>setEditing(false)} onSave={next=>{onUpdate(next);setEditing(false);setMessage("Đã cập nhật thông tin hội viên.")}}/>}{changing&&<AccountStatusModal member={member} onClose={()=>setChanging(false)} onConfirm={()=>{onUpdate({...member,accountStatus:member.accountStatus==="Đang hoạt động"?"Đã khóa":"Đang hoạt động"});setChanging(false);setMessage(member.accountStatus==="Đang hoạt động"?"Đã khóa tài khoản hội viên.":"Đã mở khóa tài khoản hội viên.")}}/>}</>;
}
