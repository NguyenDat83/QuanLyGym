import { useState, type ReactNode } from "react";
import type { Page, Role } from "../types";
import { Icon, Logo } from "./ui";
import { useUnread } from "../features/communication/commApi";
import { avatar, memberAvatar, trainerPhotos } from "../lib/assets";

export const nav = [
  ["dashboard", "grid", "Tổng quan"], ["schedule", "calendar", "Lịch tập của tôi"],
  ["booking", "plus", "Đặt lịch tập"], ["trainers", "users", "Huấn luyện viên"],
  ["plans", "dumbbell", "Kế hoạch tập"], ["progress", "chart", "Tiến độ"],
  ["membership", "card", "Gói hội viên"], ["notifications", "bell", "Thông báo"],
  ["profile", "user", "Hồ sơ"],
] as const;

export function Shell({ page, setPage, children, role, accountName, onLogout }: { page: Page; setPage: (p: Page) => void; children: ReactNode; role: Role; accountName: string; onLogout: () => void }) {
  const unread = useUnread("/notifications/unread-count");
  const active = page === "trainer-detail" ? "trainers" : page === "workout" ? "plans" : page;
  const checkinPages: Page[] = ["checkin", "checkin-history", "checkin-duplicates", "checkin-report", "checkin-rules"];
  const isCheckin = checkinPages.includes(page);
  const [checkinOpen, setCheckinOpen] = useState(isCheckin);
  const visibleNav = role==="ADMIN"
    ? [["admin-dashboard","grid","Tổng quan Admin"],["members","users","Quản lý hội viên"],["trainer-management","dumbbell","Quản lý HLV"],["messages","message","Trung tâm liên lạc"],["support","help","Trung tâm hỗ trợ"],["notifications","bell","Thông báo"],["activity","activity","Nhật ký hoạt động"]] as const
    : role==="HLV"
      ? [["trainer-dashboard","grid","Tổng quan HLV"],["trainer-schedule","calendar","Lịch làm việc"],["assigned-members","users","Hội viên phụ trách"],["plans","clipboard","Kế hoạch tập"],["messages","message","Tin nhắn"],["support","help","Liên hệ Admin"],["notifications","bell","Thông báo"],["profile","user","Hồ sơ chuyên môn"]] as const
      : [...nav.slice(0,2),["checkin","scan","Check-in ngay"],...nav.slice(2,4),["messages","message","Tin nhắn"],["support","help","Hỗ trợ"],...nav.slice(4,8),["my-checkins","file","Lịch sử check-in"],nav[8]] as const;
  return <div className="min-h-screen bg-[#f8fafc] text-slate-900">
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col bg-[#111827] px-4 py-7">
      <div className="px-3"><Logo/></div>
      <nav className="mt-7 flex-1 space-y-1 overflow-y-auto pr-1">
        {visibleNav.map(([id, icon, label]) => <button key={id} onClick={() => setPage(id as Page)} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${active === id || (id==="members"&&page==="member-detail") ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon name={icon} size={19}/>{label}{id === "notifications" && unread > 0 && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] text-white">{unread > 99 ? "99+" : unread}</span>}</button>)}
        {role==="ADMIN"&&<div className="my-3 border-t border-slate-700/70 pt-3">
          <button onClick={()=>{setCheckinOpen(true);setPage("checkin")}} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${isCheckin ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon name="scan" size={19}/>Check-in hội viên<span className={`ml-auto transition ${checkinOpen ? "rotate-90" : ""}`}>›</span></button>
          {checkinOpen&&<div className="ml-5 mt-1 space-y-1 border-l border-slate-700 pl-3">
            {[["checkin","Check-in mới"],["checkin-history","Lịch sử check-in"],["checkin-duplicates","Quản lý lượt trùng"],["checkin-report","Báo cáo check-in"],["checkin-rules","Cấu hình quy tắc"]].map(([id,label])=><button key={id} onClick={()=>setPage(id as Page)} className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-medium ${page===id?"bg-white/10 text-white":"text-slate-500 hover:text-white"}`}>{label}{id==="checkin-duplicates"&&<span className="float-right rounded-full bg-orange-500 px-1.5 text-[9px] text-white">3</span>}</button>)}
          </div>}
        </div>}
      </nav>
      <div className="mt-auto border-t border-slate-700/70 pt-4"><div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-[10px] leading-4 text-slate-500">Dữ liệu prototype được lưu trong phiên hiện tại.</div><button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"><Icon name="logout" size={19}/>Đăng xuất</button></div>
    </aside>
    <div className="ml-64">
      <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-8 backdrop-blur">
        <div className="flex w-80 items-center gap-3 rounded-xl bg-slate-100 px-4 py-2.5 text-slate-400"><Icon name="search" size={19}/><input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Tìm kiếm..."/></div>
        <div className="flex items-center gap-5"><button onClick={()=>setPage("notifications")} className="relative text-slate-500"><Icon name="bell" size={22}/>{unread>0&&<i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-white bg-red-500"/>}</button><div className="h-8 w-px bg-slate-200"/><img src={role==="ADMIN"?avatar:role==="HLV"?trainerPhotos[0]:memberAvatar} className="h-10 w-10 rounded-full object-cover" alt={accountName}/><div className="-ml-2"><p className="text-sm font-semibold">{accountName}</p><p className="text-xs text-slate-500">{role==="ADMIN"?"Quản trị viên hệ thống":role==="HLV"?"Huấn luyện viên cá nhân":"Hội viên GYM PRO"}</p></div><span className="text-slate-400">⌄</span></div>
      </header>
      <main className="mx-auto max-w-[1180px] p-8">{children}</main>
    </div>
  </div>;
}
