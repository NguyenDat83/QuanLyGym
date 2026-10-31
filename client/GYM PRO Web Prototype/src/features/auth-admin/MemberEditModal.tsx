import { useState } from "react";
import type { Member } from "../../types";
import { Button, Card, Icon } from "../../components/ui";

export function MemberEditModal({ member, members, onClose, onSave }: { member:Member; members:Member[]; onClose:()=>void; onSave:(member:Member)=>void }) {
  const [draft,setDraft]=useState(member);
  const [error,setError]=useState("");
  const save=()=>{
    if(!draft.name.trim()||!draft.email.trim()||!draft.phone.trim()){setError("Vui lòng nhập đầy đủ họ tên, email và số điện thoại.");return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)){setError("Email không đúng định dạng.");return}
    if(members.some(item=>item.id!==draft.id&&item.email.toLowerCase()===draft.email.toLowerCase())){setError("Email đã thuộc về một hội viên khác.");return}
    onSave({...draft,name:draft.name.trim(),email:draft.email.trim().toLowerCase()});
  };
  const input=(label:string,key:keyof Member)=><label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">{label}</span><input value={String(draft[key])} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"/></label>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6"><Card className="w-full max-w-2xl p-6 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-xl font-bold">Chỉnh sửa hội viên</h2><p className="mt-1 text-sm text-slate-500">{member.name} · {member.id}</p></div><button onClick={onClose} className="text-slate-400"><Icon name="x"/></button></div>{error&&<div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="mt-5 grid grid-cols-2 gap-4">{input("Họ và tên","name")}{input("Email","email")}{input("Số điện thoại","phone")}{input("Ngày sinh","birthDate")}<label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Giới tính</span><select value={draft.gender} onChange={e=>setDraft({...draft,gender:e.target.value})} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>{input("Mục tiêu tập luyện","goal")}</div><div className="mt-6 flex justify-end gap-3"><Button secondary onClick={onClose}>Hủy</Button><Button onClick={save}>Lưu thay đổi</Button></div></Card></div>;
}
