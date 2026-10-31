import type { Member, Page } from "../../types";
import { Button, Card, PageTitle, StatusPill } from "../../components/ui";

export function AssignedMembers({ members, setPage }: { members:Member[]; setPage:(page:Page)=>void }) {
  const assigned=members;
  return <><PageTitle title="Hội viên được phân công" desc="Chỉ hiển thị hồ sơ thuộc phạm vi huấn luyện của bạn."/><div className="grid grid-cols-3 gap-5">{assigned.map(item=><Card key={item.id} className="p-5"><div className="flex gap-4"><img src={item.avatar} className="h-14 w-14 rounded-xl object-cover" alt={item.name}/><div><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{item.id} · {item.plan}</p><StatusPill tone="green">{item.accountStatus}</StatusPill></div></div><div className="my-4 rounded-xl bg-slate-50 p-3 text-xs"><span className="text-slate-500">Mục tiêu</span><b className="mt-1 block">{item.goal}</b></div><div className="flex gap-2"><Button secondary onClick={()=>setPage("plans")} className="flex-1 py-2">Kế hoạch</Button><Button onClick={()=>setPage("messages")} className="flex-1 py-2">Nhắn tin</Button></div></Card>)}</div></>;
}
