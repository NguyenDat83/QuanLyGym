import { useEffect, useState } from "react";
import { api } from "../../api";
import { LoadState, useApi } from "../../lib/useApi";
import { keyToVi, vnDateKey, vnTime } from "../../lib/format";
import { APPT_LABEL } from "../../lib/labels";
import { Button, Card, EmptyState, Icon, MetricCard, PageTitle } from "../../components/ui";

type TodayAppt = {
  _id: string;
  startAt: string;
  endAt: string;
  status: string;
  note?: string;
  memberId: { _id: string; code: string; fullName: string; phone?: string } | null;
  trainerId: { code: string; fullName: string } | null;
  checkin: { checkInTime: string; status: string } | null;
};
type Result = { tone: "green" | "orange" | "red"; text: string } | null;

// Dòng một lịch hẹn: tên hội viên, giờ, HLV, trạng thái và nút thao tác
function ApptRow({ a, busy, onCheckin, onNoShow }: { a: TodayAppt; busy: boolean; onCheckin: (a: TodayAppt) => void; onNoShow: (a: TodayAppt) => void }) {
  const [label, cls] = APPT_LABEL[a.status] ?? [a.status, "bg-slate-100 text-slate-600"];
  const ended = new Date(a.endAt).getTime() < Date.now();
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0">
      <div className="w-24 text-center">
        <b className="block text-sm">{vnTime(a.startAt)}</b>
        <span className="text-[10px] text-slate-400">đến {vnTime(a.endAt)}</span>
      </div>
      <div className="flex-1">
        <b className="text-sm">{a.memberId?.fullName ?? "Hội viên"}</b>
        <p className="mt-1 text-xs text-slate-500">
          {a.memberId?.code} · {a.memberId?.phone ?? "chưa có SĐT"} · HLV {a.trainerId?.fullName ?? "—"} · Mã lịch {String(a._id).slice(-8).toUpperCase()}
        </p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
      <div className="flex w-48 justify-end gap-2">
        {a.status === "Confirmed" && (
          <>
            {ended && (
              <Button secondary disabled={busy} onClick={() => onNoShow(a)} className="py-2">
                Không đến
              </Button>
            )}
            <Button disabled={busy} onClick={() => onCheckin(a)} className="py-2">
              Check-in
            </Button>
          </>
        )}
        {a.checkin && <span className="text-xs text-slate-500">Vào lúc {vnTime(a.checkin.checkInTime)}</span>}
      </div>
    </div>
  );
}

// Admin thực hiện nghiệp vụ quầy: tra cứu hội viên/lịch hôm nay, check-in, ghi nhận không đến
export function CheckinNew() {
  const today = useApi<TodayAppt[]>("/checkins/today");
  const [now, setNow] = useState(new Date());
  const [q, setQ] = useState("");
  const [found, setFound] = useState<TodayAppt[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const list = today.data ?? [];
  const checked = list.filter((a) => a.checkin || ["CheckedIn", "Completed"].includes(a.status)).length;
  const waiting = list.filter((a) => a.status === "Confirmed" && new Date(a.endAt).getTime() > now.getTime()).length;
  const noShow = list.filter((a) => a.status === "NoShow").length;

  const search = async () => {
    if (q.trim().length < 2) { setResult({ tone: "red", text: "Nhập ít nhất 2 ký tự: mã hội viên, tên, số điện thoại hoặc mã lịch hẹn." }); return; }
    setSearching(true); setResult(null);
    try { setFound(await api.get(`/checkins/lookup?q=${encodeURIComponent(q.trim())}`)); }
    catch (e: any) { setFound(null); setResult({ tone: "red", text: e?.message || "Không tìm được." }); }
    setSearching(false);
  };
  const refresh = async () => { today.reload(); if (found) await search(); };
  const checkin = async (a: TodayAppt) => {
    setBusy(true); setResult(null);
    try {
      const r = await api.post("/checkins", { appointmentId: a._id });
      setResult(r.duplicate
        ? { tone: "orange", text: `Lượt check-in của ${a.memberId?.fullName} đã được ghi nhận trước đó, hệ thống không tạo bản ghi mới.` }
        : { tone: "green", text: `Check-in thành công cho ${a.memberId?.fullName} lúc ${vnTime(new Date().toISOString())}.` });
    } catch (e: any) {
      setResult({ tone: "red", text: e?.message || "Không check-in được." });
    }
    setBusy(false);
    await refresh();
  };
  const markNoShow = async (a: TodayAppt) => {
    if (!window.confirm(`Ghi nhận ${a.memberId?.fullName} không đến buổi ${vnTime(a.startAt)}? Buổi PT sẽ không được hoàn lại.`)) return;
    setBusy(true); setResult(null);
    try {
      await api.post(`/appointments/${a._id}/no-show`);
      setResult({ tone: "green", text: `Đã ghi nhận ${a.memberId?.fullName} không đến.` });
    } catch (e: any) {
      setResult({ tone: "red", text: e?.message || "Không cập nhật được." });
    }
    setBusy(false);
    await refresh();
  };
  const banner = result && (
    <div className={`mb-5 rounded-xl border p-3 text-sm ${result.tone === "green" ? "border-green-200 bg-green-50 text-green-700" : result.tone === "orange" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-red-200 bg-red-50 text-red-700"}`}>
      {result.text}
    </div>
  );
  return (
    <>
      <PageTitle
        title="Check-in hội viên"
        desc="Tra cứu hội viên, kiểm tra điều kiện và ghi nhận lượt vào phòng tập (mỗi lịch hẹn chỉ check-in một lần)."
        action={<div className="text-right"><p className="text-sm font-bold">{now.toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })} · {keyToVi(vnDateKey(now))}</p></div>}
      />
      <div className="mb-5 grid grid-cols-4 gap-4">
        <MetricCard icon="calendar" label="Lịch hôm nay" value={String(list.length)} note="Đã xác nhận trở lên" tone="blue" />
        <MetricCard icon="check" label="Đã check-in" value={String(checked)} note="Lượt vào phòng tập" tone="green" />
        <MetricCard icon="clock" label="Đang chờ" value={String(waiting)} note="Chưa check-in, chưa qua giờ" tone="orange" />
        <MetricCard icon="alert" label="Không đến" value={String(noShow)} note="Đã ghi nhận hôm nay" tone="red" />
      </div>
      {banner}
      <Card className="mb-5 p-5">
        <h2 className="font-bold">Tìm hội viên hoặc lịch hẹn</h2>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 px-4">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className="w-full py-3.5 text-sm outline-none" placeholder="Mã hội viên, họ tên, số điện thoại hoặc mã lịch hẹn (8 ký tự)" />
          <Button disabled={searching} onClick={search} className="my-1.5 py-2">{searching ? "Đang tìm..." : "Tìm kiếm"}</Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Chỉ hiển thị lịch của hôm nay. Mã lịch hẹn là mã hội viên nhận được sau khi đặt lịch.</p>
        {found && (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            {found.length === 0 ? <div className="p-5"><EmptyState text="Không tìm thấy lịch hôm nay phù hợp." /></div> : found.map((a) => <ApptRow key={a._id} a={a} busy={busy} onCheckin={checkin} onNoShow={markNoShow} />)}
          </div>
        )}
      </Card>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h2 className="font-bold">Lịch tập hôm nay</h2>
          <button onClick={() => today.reload()} className="text-xs font-semibold text-blue-600">Tải lại</button>
        </div>
        <div className="p-2"><LoadState error={today.error} loading={today.loading && !today.data} /></div>
        {!today.loading && list.length === 0 && !today.error && <div className="p-6"><EmptyState text="Hôm nay chưa có lịch hẹn nào được xác nhận." /></div>}
        {list.map((a) => <ApptRow key={a._id} a={a} busy={busy} onCheckin={checkin} onNoShow={markNoShow} />)}
      </Card>
    </>
  );
}
