import { type ReactNode } from "react";

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
    dumbbell: <><path d="m6.5 6.5 11 11M21 21l-1.5-1.5M3 3l1.5 1.5M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7"/></>,
    chart: <><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-8"/></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    flame: <path d="M12 22c4 0 7-3 7-7 0-3-1-5-4-8 0 3-2 4-3 4 0-4-2-7-4-9 0 5-3 7-3 12 0 4 3 8 7 8Z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="m9 18 6-6-6-6"/>,
    star: <path d="m12 2 3 6 6.5 1-4.7 4.6 1.1 6.4-5.9-3-5.9 3 1.1-6.4L2.5 9 9 8Z"/>,
    trophy: <><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    map: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    x: <path d="M6 6l12 12M18 6 6 18"/>,
    scan: <><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M7 12h10"/></>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3Z"/><circle cx="12" cy="13" r="3"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    alert: <><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    refresh: <><path d="M20 7h-5V2"/><path d="M20 7a8 8 0 1 0 1 7"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.1 2.3c-.9.3-.9 1.2-.9 1.7M12 17h.01"/></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/></>,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name] ?? paths.grid}</svg>;
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><Icon name="dumbbell" size={22}/></div><div><b className={`text-lg tracking-tight ${dark ? "text-slate-900" : "text-white"}`}>GYM <span className="text-blue-500">PRO</span></b><p className={`text-[9px] font-semibold tracking-[.18em] ${dark ? "text-slate-400" : "text-slate-500"}`}>FITNESS MANAGEMENT</p></div></div>;
}

export function Button({ children, onClick, secondary = false, danger = false, disabled = false, className = "" }: { children: ReactNode; onClick?: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; className?: string }) {
  const appearance = danger ? "bg-red-500 text-white shadow-sm shadow-red-100 hover:bg-red-600" : secondary ? "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-600" : "bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700";
  return <button disabled={disabled} onClick={onClick} className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${appearance} disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${className}`}>{children}</button>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,.04)] ${className}`}>{children}</div>;
}

export function PageTitle({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return <div className="mb-7 flex items-end justify-between"><div><h1 className="text-[26px] font-bold tracking-tight text-slate-900">{title}</h1><p className="mt-1.5 text-sm text-slate-500">{desc}</p></div>{action}</div>;
}

export function StatusPill({ children, tone = "slate" }: { children: ReactNode; tone?: "green" | "red" | "orange" | "blue" | "slate" }) {
  const tones = {green:"bg-green-50 text-green-700",red:"bg-red-50 text-red-700",orange:"bg-orange-50 text-orange-700",blue:"bg-blue-50 text-blue-700",slate:"bg-slate-100 text-slate-600"};
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}><i className={`h-1.5 w-1.5 rounded-full ${tone==="green"?"bg-green-500":tone==="red"?"bg-red-500":tone==="orange"?"bg-orange-500":tone==="blue"?"bg-blue-500":"bg-slate-400"}`}/>{children}</span>;
}

export function MetricCard({ icon, label, value, note, tone = "blue" }: { icon: string; label: string; value: string; note: string; tone?: "blue" | "green" | "orange" | "red" }) {
  const tones = {blue:"bg-blue-50 text-blue-600",green:"bg-green-50 text-green-600",orange:"bg-orange-50 text-orange-600",red:"bg-red-50 text-red-600"};
  return <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-[10px] text-slate-400">{note}</p></div><span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}><Icon name={icon} size={19}/></span></div></Card>;
}

export function EmptyState({ text = "Chưa có dữ liệu" }: { text?: string }) {
  return <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center"><div><span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-white text-slate-400"><Icon name="file" size={19}/></span><p className="mt-3 text-sm font-semibold text-slate-500">{text}</p></div></div>;
}
