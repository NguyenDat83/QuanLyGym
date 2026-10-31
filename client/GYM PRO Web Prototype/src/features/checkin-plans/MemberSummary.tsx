import { memberAvatar } from "../../lib/assets";
import { StatusPill } from "../../components/ui";

export function MemberSummary({ compact = false }: { compact?: boolean }) {
  return <div className={`flex ${compact?"items-center":"items-start"} gap-4`}>
    <img src={memberAvatar} className={`${compact?"h-12 w-12":"h-20 w-20"} rounded-2xl object-cover`} alt="Nguyễn Văn Minh"/>
    <div className="flex-1"><div className="flex items-center gap-2"><h3 className={`${compact?"text-sm":"text-lg"} font-bold`}>Nguyễn Văn Minh</h3><StatusPill tone="green">Đang hoạt động</StatusPill></div><p className="mt-1 text-xs text-slate-500">HV00125 · 090 *** 682 · minh.nguyen@example.com</p>{!compact&&<div className="mt-3 flex gap-5 text-xs"><span><b className="block text-slate-800">Premium</b><span className="text-slate-400">Gói hội viên</span></span><span><b className="block text-slate-800">01/10 — 31/12/2026</b><span className="text-slate-400">Thời hạn</span></span><span><b className="block text-slate-800">Nguyễn Minh Hoàng</b><span className="text-slate-400">Huấn luyện viên</span></span></div>}</div>
  </div>;
}
