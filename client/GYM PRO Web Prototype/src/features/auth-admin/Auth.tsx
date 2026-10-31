import { useState } from "react";
import type { Member, Page } from "../../types";
import { initialMembers } from "./initialMembers";
import { gymPhoto, memberAvatar } from "../../lib/assets";
import { Button, Icon, Logo } from "../../components/ui";

export function Auth({ register, setPage, members, onRegister, onLogin, notice }: { register?: boolean; setPage: (p: Page) => void; members: Member[]; onRegister: (member: Member) => Promise<string | null>; onLogin: (email:string,password:string) => Promise<string | null>; notice?: string }) {
  const nextId=`HV${String(126+members.length-initialMembers.length).padStart(5,"0")}`;
  const [form,setForm]=useState({name:"",email:"",phone:"",birthDate:"",gender:"Nam",password:"",confirmPassword:"",goal:""});
  const [login,setLogin]=useState({email:"",password:""});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [remember,setRemember]=useState(true);
  const [accepted,setAccepted]=useState(false);
  const change=(key:string,value:string)=>{setForm({...form,[key]:value});setErrors({...errors,[key]:"",general:""})};
  const submitRegister=async()=>{
    const next:Record<string,string>={};
    if(!form.name.trim()) next.name="Vui lòng nhập họ và tên.";
    if(!form.email.trim()) next.email="Vui lòng nhập email.";
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email="Email không đúng định dạng.";
    else if(members.some(member=>member.email.toLowerCase()===form.email.toLowerCase())||form.email.toLowerCase()==="admin@gympro.vn") next.email="Email này đã được sử dụng.";
    if(!form.phone.trim()) next.phone="Vui lòng nhập số điện thoại.";
    if(!form.birthDate) next.birthDate="Vui lòng chọn ngày sinh.";
    if(form.password.length<8) next.password="Mật khẩu cần ít nhất 8 ký tự.";
    if(form.confirmPassword!==form.password) next.confirmPassword="Mật khẩu xác nhận không khớp.";
    if(!form.goal.trim()) next.goal="Vui lòng nhập mục tiêu tập luyện.";
    if(!accepted) next.terms="Bạn cần đồng ý điều khoản sử dụng.";
    setErrors(next);
    if(Object.keys(next).length) return;
    const failed=await onRegister({id:nextId,name:form.name.trim(),email:form.email.trim().toLowerCase(),phone:form.phone.trim(),birthDate:form.birthDate.split("-").reverse().join("/"),gender:form.gender,password:form.password,role:"HỘI VIÊN",joined:"10/10/2026",accountStatus:"Đang hoạt động",plan:"Chưa đăng ký",planStart:"—",planEnd:"—",planStatus:"Chưa đăng ký",goal:form.goal.trim(),avatar:memberAvatar,checkinsToday:0,upcomingBookings:0});
    if(failed) setErrors({general:failed});
  };
  const submitLogin=async()=>{
    const next:Record<string,string>={};
    if(!login.email.trim()) next.email="Vui lòng nhập email.";
    if(!login.password) next.password="Vui lòng nhập mật khẩu.";
    if(Object.keys(next).length){setErrors(next);return}
    const message=await onLogin(login.email.trim().toLowerCase(),login.password);
    if(message) setErrors({general:message});
  };
  const authField=(key:keyof typeof form,label:string,type="text",placeholder="")=><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input value={form[key]} onChange={e=>change(key,e.target.value)} type={type} placeholder={placeholder} className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-4 ${errors[key]?"border-red-300 focus:border-red-500 focus:ring-red-50":"border-slate-200 focus:border-blue-500 focus:ring-blue-50"}`}/>{errors[key]&&<span className="mt-1.5 block text-xs text-red-600">{errors[key]}</span>}</label>;
  return <div className="flex min-h-screen bg-white">
    <section className="relative hidden w-[42%] overflow-hidden lg:block"><img src={gymPhoto} className="absolute inset-0 h-full w-full object-cover" alt="Không gian phòng tập GYM PRO"/><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/20"/><div className="relative flex h-full flex-col justify-between p-12"><Logo/><div className="max-w-md pb-10 text-white"><p className="mb-4 text-sm font-semibold uppercase tracking-[.2em] text-blue-400">Nâng tầm giới hạn</p><h1 className="text-4xl font-bold leading-tight">Tập luyện thông minh.<br/>Sống khỏe mạnh.</h1><p className="mt-5 text-base leading-7 text-slate-300">Mọi lịch tập, mục tiêu và thành tích của bạn trong một nền tảng duy nhất.</p><div className="mt-8 rounded-xl border border-white/10 bg-white/10 p-4 text-xs leading-5 text-slate-300 backdrop-blur"><b className="text-white">Prototype xác thực phân quyền</b><br/>Dữ liệu chỉ được lưu trong phiên hiện tại, chưa kết nối cơ sở dữ liệu hay dịch vụ xác thực thật.</div></div></div></section>
    <section className="flex flex-1 items-center justify-center overflow-y-auto px-10 py-8"><div className={`w-full ${register?"max-w-[650px]":"max-w-[480px]"}`}>
      <Logo dark/><div className="mb-7 mt-8"><h2 className="text-3xl font-bold tracking-tight">{register ? "Đăng ký tài khoản hội viên" : "Chào mừng trở lại"}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{register ? "Tài khoản mới mặc định có vai trò Hội viên." : "Đăng nhập để tiếp tục sử dụng hệ thống GYM PRO."}</p></div>
      {notice&&!register&&<div className="mb-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"><Icon name="check" size={18}/><span>{notice}</span></div>}
      {errors.general&&<div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><Icon name="alert" size={18}/><span>{errors.general}</span></div>}
      {register?<><div className="mb-4 rounded-xl bg-slate-50 p-4"><span className="text-xs font-medium text-slate-500">Mã hội viên được tạo tự động</span><b className="mt-1 block text-lg text-blue-600">Cấp sau khi đăng ký</b></div><div className="grid grid-cols-2 gap-4">{authField("name","Họ và tên","text","Nguyễn Văn An")}{authField("email","Email","email","email@example.com")}{authField("phone","Số điện thoại","tel","090 123 4567")}{authField("birthDate","Ngày sinh","date")}<label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Giới tính</span><select value={form.gender} onChange={e=>change("gender",e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>{authField("goal","Mục tiêu tập luyện","text","Giảm cân, tăng sức bền")}{authField("password","Mật khẩu","password","Tối thiểu 8 ký tự")}{authField("confirmPassword","Xác nhận mật khẩu","password","Nhập lại mật khẩu")}</div><label className="mt-5 flex items-start gap-2 text-sm text-slate-600"><input type="checkbox" checked={accepted} onChange={e=>{setAccepted(e.target.checked);setErrors({...errors,terms:""})}} className="mt-0.5 accent-blue-600"/>Tôi đồng ý với điều khoản sử dụng và chính sách quyền riêng tư của GYM PRO.</label>{errors.terms&&<span className="mt-1 block text-xs text-red-600">{errors.terms}</span>}<Button onClick={submitRegister} className="mt-6 w-full">Tạo tài khoản hội viên</Button></>
      :<><div className="space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email</span><input value={login.email} onChange={e=>{setLogin({...login,email:e.target.value});setErrors({})}} type="email" placeholder="email@example.com" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-4 ${errors.email?"border-red-300 focus:ring-red-50":"border-slate-200 focus:border-blue-500 focus:ring-blue-50"}`}/>{errors.email&&<span className="mt-1.5 block text-xs text-red-600">{errors.email}</span>}</label><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Mật khẩu</span><input value={login.password} onChange={e=>{setLogin({...login,password:e.target.value});setErrors({})}} type="password" placeholder="••••••••" className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-4 ${errors.password?"border-red-300 focus:ring-red-50":"border-slate-200 focus:border-blue-500 focus:ring-blue-50"}`}/>{errors.password&&<span className="mt-1.5 block text-xs text-red-600">{errors.password}</span>}</label></div><div className="my-5 flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="accent-blue-600"/>Ghi nhớ đăng nhập</label><button onClick={()=>setErrors({general:"Đã gửi liên kết khôi phục mật khẩu mô phỏng. Không có email thật được gửi."})} className="font-semibold text-blue-600">Quên mật khẩu?</button></div><Button onClick={submitLogin} className="w-full">Đăng nhập</Button><div className="mt-5 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-700"><b>Tài khoản trình diễn</b><br/>Admin: admin@gympro.vn · Admin@123<br/><span className="text-blue-500">HLV: hoang.nguyen@gympro.vn · Trainer@123<br/>Hội viên: minh.nguyen@gympro.vn · Member@123</span></div></>}
      <p className="mt-6 text-center text-sm text-slate-500">{register ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <button onClick={() => {setErrors({});setPage(register ? "login" : "register")}} className="font-semibold text-blue-600">{register ? "Đăng nhập" : "Đăng ký ngay"}</button></p>
    </div></section>
  </div>;
}
