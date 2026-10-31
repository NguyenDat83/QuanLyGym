import { useState } from "react";
import { api } from "../../api";
import type { Member } from "../../types";
import { viDateToIso } from "../../lib/format";
import { fromApiMember } from "./memberApi";
import { Button, Card, PageTitle } from "../../components/ui";

export function Profile({ member, onSaved }: { member: Member; onSaved: (m: Member) => void }) {
  const [draft, setDraft] = useState({ name: member.name, phone: member.phone, birthDate: member.birthDate, gender: member.gender, goal: member.goal });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof draft, v: string) => { setDraft({ ...draft, [k]: v }); setMsg(""); setErr(""); };
  const save = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const body: Record<string, unknown> = { fullName: draft.name.trim(), phone: draft.phone.trim(), gender: draft.gender, goal: draft.goal.trim() };
      const iso = viDateToIso(draft.birthDate);
      if (iso) body.dob = iso;
      const r = await api.patch("/members/me", body);
      onSaved({ ...member, ...fromApiMember({ ...r, accountStatus: member.accountStatus }) });
      setMsg("Đã lưu thay đổi vào hệ thống.");
    } catch (e: any) {
      setErr(e?.message || "Không lưu được thay đổi");
    }
    setBusy(false);
  };
  const input = (label: string, key: keyof typeof draft, full = false, placeholder = "") => <label className={`block ${full ? "col-span-2" : ""}`}><span className="mb-2 block text-xs font-semibold text-slate-600">{label}</span><input value={draft[key]} placeholder={placeholder} onChange={e=>set(key, e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"/></label>;
  return <><PageTitle title="Hồ sơ cá nhân" desc="Quản lý thông tin cá nhân và cài đặt tài khoản."/>
    {msg&&<div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</div>}
    {err&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
    <div className="grid grid-cols-[260px_1fr] gap-6"><Card className="p-6 text-center"><img src={member.avatar} className="mx-auto h-28 w-28 rounded-full object-cover ring-4 ring-blue-50" alt={member.name}/><h2 className="mt-4 text-lg font-bold">{member.name}</h2><p className="text-sm text-slate-500">Hội viên {member.plan}</p><span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${member.accountStatus==="Đang hoạt động"?"bg-green-50 text-green-600":"bg-red-50 text-red-600"}`}>{member.accountStatus}</span><div className="mt-6 border-t border-slate-100 pt-5 text-left text-xs text-slate-500">Mã hội viên <b className="float-right text-slate-800">{member.id}</b></div></Card>
      <div className="space-y-5"><Card className="p-6"><h2 className="mb-5 font-bold">Thông tin cá nhân</h2><div className="grid grid-cols-2 gap-4">{input("Họ và tên","name")}<label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Email (không đổi được)</span><input value={member.email} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"/></label>{input("Số điện thoại","phone")}{input("Ngày sinh (dd/mm/yyyy)","birthDate")}<label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">Giới tính</span><select value={draft.gender} onChange={e=>set("gender",e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"><option>Nam</option><option>Nữ</option><option>Khác</option></select></label></div></Card>
        <Card className="p-6"><h2 className="mb-5 font-bold">Mục tiêu tập luyện</h2><div className="grid grid-cols-2 gap-4">{input("Mục tiêu","goal",true)}</div><div className="mt-6 text-right"><Button disabled={busy} onClick={save}>{busy?"Đang lưu...":"Lưu thay đổi"}</Button></div></Card></div></div></>;
}
