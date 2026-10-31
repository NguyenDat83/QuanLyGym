import { useState, useEffect } from "react";
import { api } from "../../api";
import type { Trainer } from "../../types";
import { fromApiTrainer } from "./trainerApi";
import { Button, Card, Icon, PageTitle, StatusPill } from "../../components/ui";

export function TrainerProfile({ trainer, onSaved }: { trainer:Trainer; onSaved:(t:Trainer)=>void }) {
  const [form,setForm]=useState({name:trainer.name,phone:trainer.phone,specialty:trainer.specialty,years:trainer.experience.replace(/\D/g,""),certificate:trainer.certificate==="—"?"":trainer.certificate,bio:""});
  const [msg,setMsg]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{api.get("/trainers/me/profile").then(t=>setForm(f=>({...f,bio:t.bio??""}))).catch(()=>{})},[]);
  const set=(k:string,v:string)=>{setForm({...form,[k]:v});setMsg("");setErr("")};
  const save=async()=>{
    if(!form.name.trim()){setErr("Vui lòng nhập họ và tên.");return}
    setBusy(true);setErr("");setMsg("");
    try{
      const t=await api.patch("/trainers/me/profile",{fullName:form.name.trim(),phone:form.phone.trim(),expertise:form.specialty.trim(),bio:form.bio.trim(),certificate:form.certificate.trim(),...(form.years!==""?{experienceYears:Number(form.years)}:{})});
      onSaved(fromApiTrainer(t));
      setMsg("Đã lưu hồ sơ vào hệ thống.");
    }catch(e:any){setErr(e?.message||"Không lưu được hồ sơ.")}
    setBusy(false);
  };
  const inp=(label:string,k:keyof typeof form,type="text",ro=false)=><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input value={form[k]} readOnly={ro} type={type} onChange={e=>set(k,e.target.value)} className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 ${ro?"bg-slate-50 text-slate-500":""}`}/></label>;
  return <><PageTitle title="Hồ sơ chuyên môn" desc="Cập nhật thông tin được hiển thị cho hội viên và Admin." action={<Button disabled={busy} onClick={save}><Icon name="edit" size={16}/> {busy?"Đang lưu...":"Lưu hồ sơ"}</Button>}/>{msg&&<div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{msg}</div>}{err&&<div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}<div className="grid grid-cols-[280px_1fr] gap-6"><Card className="p-6 text-center"><img src={trainer.avatar} className="mx-auto h-28 w-28 rounded-2xl object-cover object-top" alt={trainer.name}/><h2 className="mt-4 text-lg font-bold">{trainer.name}</h2><p className="mt-1 text-sm text-blue-600">{trainer.specialty}</p><StatusPill tone="green">{trainer.status}</StatusPill><div className="mt-6 border-t border-slate-100 pt-5 text-left text-xs text-slate-500">Mã HLV <b className="float-right text-slate-800">{trainer.id}</b></div></Card><div className="space-y-5"><Card className="p-6"><h2 className="mb-5 font-bold">Thông tin liên hệ</h2><div className="grid grid-cols-2 gap-4">{inp("Họ và tên","name")}<label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email (không đổi được)</span><input value={trainer.email} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none"/></label>{inp("Số điện thoại","phone","tel")}{inp("Kinh nghiệm (số năm)","years","number")}</div></Card><Card className="p-6"><h2 className="mb-5 font-bold">Chuyên môn & chứng chỉ</h2><div className="grid grid-cols-2 gap-4">{inp("Chuyên môn chính","specialty")}{inp("Chứng chỉ","certificate")}</div><label className="mt-4 block text-sm font-semibold text-slate-700">Giới thiệu<textarea value={form.bio} onChange={e=>set("bio",e.target.value)} className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm font-normal outline-none focus:border-blue-500"/></label></Card></div></div></>;
}
