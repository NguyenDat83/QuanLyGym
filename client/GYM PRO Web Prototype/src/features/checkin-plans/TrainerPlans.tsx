import { useState } from "react";
import { api } from "../../api";
import type { Member, Page } from "../../types";
import { LoadState, useApi } from "../../lib/useApi";
import { Button, Card, EmptyState, PageTitle, StatusPill } from "../../components/ui";

export type PlanEx = { name: string; sets: string; reps: string; rest: string };

export type PlanDayEd = { day: string; title: string; exercises: PlanEx[] };

export type PlanEditor = { planId?: string; goal: string; weeks: { week: number; days: PlanDayEd[] }[] };

export const PLAN_DAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

export const toEditor = (p: any): PlanEditor => ({
  planId: p.planId,
  goal: p.goal ?? "",
  weeks: (p.weeks ?? []).map((w: any) => ({
    week: w.week,
    days: (w.days ?? []).map((d: any) => ({ day: d.day, title: d.title ?? "", exercises: (d.exercises ?? []).map((e: any) => ({ name: e.name, sets: String(e.sets), reps: String(e.reps), rest: String(e.restSeconds) })) })),
  })),
});

export function TrainerPlans({ members, setPage }: { members: Member[]; setPage: (p: Page) => void }) {
  const [mid, setMid] = useState<string>(members[0]?._id ?? "");
  const plansApi = useApi<any[]>(mid ? `/plans/member/${mid}` : null);
  const [ed, setEd] = useState<PlanEditor | null>(null);
  const [wk, setWk] = useState(0);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const member = members.find((m) => m._id === mid);
  // Mỗi giáo án (planId) lấy phiên bản cao nhất; chọn giáo án mới nhất
  const latestOf = new Map<string, any>();
  for (const p of plansApi.data ?? []) {
    const cur = latestOf.get(String(p.planId));
    if (!cur || p.version > cur.version) latestOf.set(String(p.planId), p);
  }
  const latest = [...latestOf.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const flash = (m: string, e = "") => { setMsg(m); setErr(e); };
  const pick = (id: string) => { setMid(id); setEd(null); setWk(0); flash(""); };
  const blank = (): PlanEditor => ({ goal: member?.goal && member.goal !== "Chưa cập nhật" ? member.goal : "", weeks: [{ week: 1, days: [{ day: "Thứ Hai", title: "", exercises: [{ name: "", sets: "3", reps: "10", rest: "60" }] }] }] });
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); flash("");
    try { await fn(); } catch (e: any) { flash("", e?.message || "Có lỗi xảy ra."); }
    setBusy(false);
  };
  const revise = () => run(async () => {
    const d = await api.post(`/plans/${latest.planId}/revise`, { memberId: mid });
    plansApi.reload(); setEd(toEditor(d)); setWk(0);
  });
  const publish = (planId: string) => run(async () => {
    await api.post(`/plans/${planId}/publish`, { memberId: mid });
    plansApi.reload(); setEd(null); flash("Đã xuất bản giáo án. Hội viên sẽ thấy ngay trong trang Kế hoạch tập.");
  });
  const save = () => run(async () => {
    if (!ed) return;
    const weeks = ed.weeks.map((w) => ({
      week: w.week,
      days: w.days.map((d) => ({
        day: d.day, title: d.title.trim() || undefined,
        exercises: d.exercises.filter((x) => x.name.trim() || x.sets || x.reps).map((x) => ({ name: x.name.trim(), sets: Number(x.sets), reps: Number(x.reps), restSeconds: Number(x.rest || 0) })),
      })),
    }));
    const body = { memberId: mid, goal: ed.goal.trim() || undefined, weeks };
    if (ed.planId) await api.put(`/plans/${ed.planId}`, body);
    else {
      const created = await api.post("/plans", body);
      setEd({ ...ed, planId: created.planId });
    }
    plansApi.reload(); flash("Đã lưu bản nháp.");
  });
  const upd = (fn: (e: PlanEditor) => void) => { if (!ed) return; const c: PlanEditor = JSON.parse(JSON.stringify(ed)); fn(c); setEd(c); flash(""); };
  const w = ed?.weeks[wk];
  const sum = (p: any) => (p.weeks ?? []).reduce((n: number, x: any) => n + (x.days ?? []).reduce((m: number, d: any) => m + (d.exercises?.length ?? 0), 0), 0);
  const tone = (st: string) => (st === "Published" ? "green" : st === "Draft" ? "orange" : "slate");
  const label = (st: string) => (st === "Published" ? "Đã xuất bản" : st === "Draft" ? "Bản nháp" : "Đã thay thế");
  const inp = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500";
  return <><PageTitle title="Kế hoạch tập" desc="Soạn, lưu nháp và xuất bản giáo án cho hội viên bạn phụ trách." action={<Button secondary onClick={() => setPage("assigned-members")}>Hội viên phụ trách</Button>}/>
    {members.length === 0 ? <Card className="p-6"><EmptyState text="Chưa có hội viên nào được xác nhận lịch với bạn. Hãy duyệt yêu cầu đặt lịch để bắt đầu soạn giáo án."/></Card> :
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <Card className="h-fit p-3">{members.map((m) => <button key={m._id} onClick={() => pick(m._id!)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${mid === m._id ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}><img src={m.avatar} className="h-9 w-9 rounded-lg object-cover" alt={m.name}/><span><b className="block text-sm">{m.name}</b><span className="text-xs text-slate-500">{m.id} · {m.plan}</span></span></button>)}</Card>
      <div className="space-y-4">
        {msg && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</div>}
        {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <LoadState error={plansApi.error} loading={plansApi.loading}/>
        {!ed && <Card className="p-6">
          <div className="flex items-start justify-between"><div><h2 className="font-bold">Giáo án của {member?.name}</h2><p className="mt-1 text-xs text-slate-500">Mục tiêu: {member?.goal}</p></div>
            <div className="flex gap-2">{!latest && <Button disabled={busy} onClick={() => { setEd(blank()); setWk(0); }}>+ Soạn giáo án</Button>}
              {latest?.status === "Draft" && <><Button secondary disabled={busy} onClick={() => { setEd(toEditor(latest)); setWk(0); }}>Chỉnh sửa</Button><Button disabled={busy} onClick={() => publish(latest.planId)}>Xuất bản</Button></>}
              {latest?.status === "Published" && <Button disabled={busy} onClick={revise}>Tạo phiên bản mới</Button>}</div></div>
          {!plansApi.loading && !latest && <div className="mt-4"><EmptyState text="Chưa có giáo án nào cho hội viên này."/></div>}
          {latest && <div className="mt-5"><div className="flex items-center gap-3 text-sm"><StatusPill tone={tone(latest.status) as any}>{label(latest.status)}</StatusPill><span className="text-slate-500">Phiên bản {latest.version} · {sum(latest)} bài tập</span></div>
            {(latest.weeks ?? []).map((wkk: any) => <div key={wkk.week} className="mt-4"><b className="text-sm">Tuần {wkk.week}</b>{(wkk.days ?? []).map((d: any) => <div key={d.day} className="mt-2 rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-sm"><b>{d.day}{d.title ? ` · ${d.title}` : ""}</b><span className="text-xs text-slate-500">{d.exercises?.length ?? 0} bài tập</span></div>{(d.exercises ?? []).map((e: any, i: number) => <p key={i} className="mt-1 text-xs text-slate-600">• {e.name} — {e.sets} hiệp × {e.reps} lần, nghỉ {e.restSeconds}s</p>)}</div>)}</div>)}</div>}
        </Card>}
        {ed && w && <Card className="p-6">
          <div className="flex items-center justify-between"><h2 className="font-bold">{ed.planId ? "Chỉnh sửa bản nháp" : "Giáo án mới"} cho {member?.name}</h2><div className="flex gap-2"><Button secondary disabled={busy} onClick={() => { setEd(null); flash(""); }}>Đóng</Button><Button secondary disabled={busy} onClick={save}>{busy ? "Đang lưu..." : "Lưu nháp"}</Button>{ed.planId && <Button disabled={busy} onClick={async () => { await save(); await publish(ed.planId!); }}>Lưu & xuất bản</Button>}</div></div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">Mục tiêu giáo án<input value={ed.goal} onChange={(e) => upd((c) => { c.goal = e.target.value; })} className={`mt-2 ${inp}`}/></label>
          <div className="mt-4 flex items-center gap-2">{ed.weeks.map((x, i) => <button key={x.week} onClick={() => setWk(i)} className={`rounded-lg px-4 py-2 text-xs font-semibold ${wk === i ? "bg-blue-600 text-white" : "bg-slate-100"}`}>Tuần {x.week}</button>)}{ed.weeks.length < 12 && <button onClick={() => { upd((c) => { c.weeks.push({ week: c.weeks.length + 1, days: [{ day: "Thứ Hai", title: "", exercises: [{ name: "", sets: "3", reps: "10", rest: "60" }] }] }); }); setWk(ed.weeks.length); }} className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">+ Thêm tuần</button>}</div>
          {w.days.map((d, di) => <div key={di} className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="flex gap-3"><select value={d.day} onChange={(e) => upd((c) => { c.weeks[wk].days[di].day = e.target.value; })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{PLAN_DAYS.map((n) => <option key={n}>{n}</option>)}</select><input placeholder="Tên buổi (vd: Ngực & Tay sau)" value={d.title} onChange={(e) => upd((c) => { c.weeks[wk].days[di].title = e.target.value; })} className={inp}/><button onClick={() => upd((c) => { c.weeks[wk].days.splice(di, 1); })} className="text-xs font-semibold text-red-600">Xóa ngày</button></div>
            {d.exercises.map((x, xi) => <div key={xi} className="mt-3 grid grid-cols-[1fr_80px_80px_90px_30px] gap-2"><input placeholder="Tên bài tập" value={x.name} onChange={(e) => upd((c) => { c.weeks[wk].days[di].exercises[xi].name = e.target.value; })} className={inp}/><input type="number" min={1} placeholder="Hiệp" value={x.sets} onChange={(e) => upd((c) => { c.weeks[wk].days[di].exercises[xi].sets = e.target.value; })} className={inp}/><input type="number" min={1} placeholder="Lần" value={x.reps} onChange={(e) => upd((c) => { c.weeks[wk].days[di].exercises[xi].reps = e.target.value; })} className={inp}/><input type="number" min={0} placeholder="Nghỉ (s)" value={x.rest} onChange={(e) => upd((c) => { c.weeks[wk].days[di].exercises[xi].rest = e.target.value; })} className={inp}/><button onClick={() => upd((c) => { c.weeks[wk].days[di].exercises.splice(xi, 1); })} className="text-slate-400">✕</button></div>)}
            <button onClick={() => upd((c) => { c.weeks[wk].days[di].exercises.push({ name: "", sets: "3", reps: "10", rest: "60" }); })} className="mt-3 text-xs font-semibold text-blue-600">+ Thêm bài tập</button></div>)}
          {w.days.length < 7 && <button onClick={() => upd((c) => { const used = c.weeks[wk].days.map((x) => x.day); c.weeks[wk].days.push({ day: PLAN_DAYS.find((n) => !used.includes(n)) ?? "Thứ Hai", title: "", exercises: [{ name: "", sets: "3", reps: "10", rest: "60" }] }); })} className="mt-4 text-sm font-semibold text-blue-600">+ Thêm ngày tập</button>}
        </Card>}
      </div>
    </div>}
  </>;
}
