import { useState } from "react";
import type { Member } from "../../types";
import { Button, Card, Icon } from "../../components/ui";
import { selection } from "../../lib/selection";

export function AccountStatusModal({ member, onClose, onConfirm }: { member:Member; onClose:()=>void; onConfirm:(reason:string)=>void }) {
  const locking=member.accountStatus==="Đang hoạt động";
  const [reason,setReason]=useState("");
  const [error,setError]=useState("");
  const confirm=()=>{if(locking&&!reason.trim()){setError("Vui lòng nhập lý do khóa tài khoản.");return}selection.lastLockReason=reason.trim();onConfirm(reason.trim())};
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6"><Card className="w-full max-w-md p-6 shadow-2xl"><span className={`grid h-12 w-12 place-items-center rounded-full ${locking?"bg-red-50 text-red-600":"bg-green-50 text-green-600"}`}><Icon name={locking?"lock":"shield"} size={22}/></span><h2 className="mt-4 text-xl font-bold">{locking?"Khóa tài khoản hội viên?":"Mở khóa tài khoản?"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{locking?"Sau khi khóa, hội viên không thể đăng nhập nhưng toàn bộ hồ sơ và lịch sử vẫn được giữ nguyên.":"Hội viên sẽ có thể đăng nhập lại bằng thông tin tài khoản hiện tại."}</p><div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><b>{member.name}</b><span className="ml-2 text-slate-500">{member.id}</span></div>{locking&&<label className="mt-4 block text-sm font-semibold">Lý do khóa<textarea value={reason} onChange={e=>{setReason(e.target.value);setError("")}} className={`mt-2 h-24 w-full resize-none rounded-xl border p-3 text-sm font-normal outline-none ${error?"border-red-300":"border-slate-200 focus:border-blue-500"}`} placeholder="Nhập lý do để lưu vào nhật ký..."/>{error&&<span className="mt-1 block text-xs text-red-600">{error}</span>}</label>}<div className="mt-6 flex justify-end gap-3"><Button secondary onClick={onClose}>Hủy</Button><Button danger={locking} onClick={confirm}>Xác nhận {locking?"khóa":"mở khóa"}</Button></div></Card></div>;
}
