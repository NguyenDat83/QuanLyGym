import { useState } from "react";
import { api } from "../../api";
import { LoadState, useApi } from "../../lib/useApi";
import { fmtDate, money, newRequestId } from "../../lib/format";
import { Button, Card } from "../../components/ui";

const METHODS = ["Thẻ ngân hàng", "Chuyển khoản QR", "Ví điện tử"];
type Pack = { _id: string; name: string; description?: string; config: { price: number; durationDays: number; ptSessions: number } };

// Mua gói tập (thanh toán MÔ PHỎNG: không trừ tiền thật, chỉ tạo hóa đơn và kích hoạt gói)
export function PurchaseModal({ pack, onClose, onPaid }: { pack: Pack; onClose: () => void; onPaid: () => void }) {
  const preview = useApi<{ startDate: string; queued: boolean; blocked: boolean }>("/payments/preview");
  const [method, setMethod] = useState(METHODS[0]);
  const [requestId] = useState(newRequestId()); // giữ nguyên khi bấm lại để không bị tính hai lần
  const [step, setStep] = useState<"confirm" | "paying" | "done">("confirm");
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState<any>(null);

  const pay = async () => {
    setError("");
    setStep("paying");
    try {
      const [r] = await Promise.all([api.post("/payments", { packageId: pack._id, method, requestId }), new Promise(res => setTimeout(res, 1200))]);
      setInvoice(r.payment);
      setStep("done");
      onPaid();
    } catch (e: any) {
      setError(e?.message || "Thanh toán không thành công");
      setStep("confirm");
    }
  };
  const p = preview.data;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6"><Card className="w-full max-w-md p-6 shadow-2xl">
    {step === "done" && invoice ? <>
      <span className="grid h-14 w-14 place-items-center rounded-full bg-green-50 text-2xl text-green-600">✓</span>
      <h2 className="mt-4 text-xl font-bold">Thanh toán thành công</h2>
      <p className="mt-1 text-sm text-slate-500">Gói của bạn đã được kích hoạt. Đây là thanh toán mô phỏng.</p>
      <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">{[["Mã hóa đơn", invoice.code], ["Gói", invoice.packageName], ["Số tiền", money(invoice.amount)], ["Phương thức", invoice.method], ["Hiệu lực", `${fmtDate(invoice.startDate)} — ${fmtDate(invoice.endDate)}`]].map(([k, v]) => <p key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><b>{v}</b></p>)}</div>
      <div className="mt-6 flex justify-end"><Button onClick={onClose}>Đóng</Button></div>
    </> : <>
      <h2 className="text-xl font-bold">Đăng ký gói {pack.name}</h2>
      <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">{[["Giá", money(pack.config.price)], ["Thời hạn", `${pack.config.durationDays} ngày`], ["Buổi PT", String(pack.config.ptSessions)]].map(([k, v]) => <p key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><b>{v}</b></p>)}{p && !p.blocked && <p className="flex justify-between"><span className="text-slate-500">Bắt đầu từ</span><b>{fmtDate(p.startDate)}{p.queued ? " (sau khi gói hiện tại hết hạn)" : ""}</b></p>}</div>
      <LoadState error={preview.error} loading={preview.loading}/>
      {p?.blocked && <p className="mt-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-700">Bạn đã có một gói đang chờ bắt đầu, nên chưa thể mua thêm.</p>}
      <div className="mt-4 text-sm font-semibold">Phương thức thanh toán<div className="mt-2 space-y-2">{METHODS.map(m => <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal ${method === m ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><input type="radio" checked={method === m} onChange={() => setMethod(m)}/>{m}</label>)}</div></div>
      <p className="mt-3 text-xs text-slate-400">Chế độ mô phỏng: hệ thống không trừ tiền thật, chỉ ghi nhận hóa đơn và kích hoạt gói.</p>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-3"><Button secondary onClick={onClose} disabled={step === "paying"}>Hủy</Button><Button onClick={pay} disabled={step === "paying" || !p || p.blocked}>{step === "paying" ? "Đang xử lý thanh toán..." : `Thanh toán ${money(pack.config.price)}`}</Button></div>
    </>}
  </Card></div>;
}
