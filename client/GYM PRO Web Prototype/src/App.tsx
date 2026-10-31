import { useState, useEffect, type ReactNode } from "react";
import { api } from "./api";
import type { BookingDetails, BookingRecord, Member, Page, Role, Trainer } from "./types";
import { useApi } from "./lib/useApi";
import { defaultBooking } from "./features/booking/defaultBooking";
import { viDateToIso } from "./lib/format";
import { fromApiMember, persistMemberChange } from "./features/members/memberApi";
import { fromApiAssigned, fromApiTrainer } from "./features/trainers/trainerApi";
import { fromApiAppt } from "./features/booking/bookingApi";
import { Auth } from "./features/auth-admin/Auth";
import { Shell } from "./components/Shell";
import { Dashboard } from "./features/members/Dashboard";
import { Button, Card, Icon } from "./components/ui";
import { Booking } from "./features/booking/Booking";
import { Success } from "./features/booking/Success";
import { Schedule } from "./features/booking/Schedule";
import { Trainers } from "./features/trainers/Trainers";
import { TrainerDetail } from "./features/trainers/TrainerDetail";
import { TrainerPlans } from "./features/checkin-plans/TrainerPlans";
import { Plans } from "./features/checkin-plans/Plans";
import { Workout } from "./features/checkin-plans/Workout";
import { Progress } from "./features/checkin-plans/Progress";
import { Membership } from "./features/members/Membership";
import { NotificationCenter } from "./features/communication/NotificationCenter";
import { TrainerProfile } from "./features/trainers/TrainerProfile";
import { Profile } from "./features/members/Profile";
import { MyCheckins } from "./features/checkin-plans/MyCheckins";
import { AdminDashboard } from "./features/auth-admin/AdminDashboard";
import { MemberManagement } from "./features/auth-admin/MemberManagement";
import { TrainerManagement } from "./features/trainers/TrainerManagement";
import { TrainerDashboard } from "./features/trainers/TrainerDashboard";
import { TrainerSchedule } from "./features/trainers/TrainerSchedule";
import { CompleteSessionModal } from "./features/trainers/CompleteSessionModal";
import { AssignedMembers } from "./features/trainers/AssignedMembers";
import { MessageCenter } from "./features/communication/MessageCenter";
import { SupportCenter } from "./features/communication/SupportCenter";
import { ActivityLogs } from "./features/communication/ActivityLogs";
import { MemberDetail } from "./features/auth-admin/MemberDetail";
import { CheckinNew } from "./features/checkin-plans/CheckinNew";
import { CheckinHistory } from "./features/checkin-plans/CheckinHistory";
import { DuplicateManagement } from "./features/checkin-plans/DuplicateManagement";
import { CheckinReport } from "./features/checkin-plans/CheckinReport";
import { CheckinRules } from "./features/checkin-plans/CheckinRules";

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [role, setRole] = useState<Role|null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string|null>(null);
  const [currentTrainerId, setCurrentTrainerId] = useState<string|null>(null);
  const [completing, setCompleting] = useState<BookingRecord|null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [trainerAccounts,setTrainerAccounts]=useState<Trainer[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("HV00125");
  const [authNotice, setAuthNotice] = useState("");
  const [booking, setBooking] = useState<BookingDetails>(defaultBooking);
  const [assignedMembers, setAssignedMembers] = useState<Member[]>([]);
  useEffect(() => {
    // HLV/Admin: tự cập nhật yêu cầu đặt lịch mới mỗi 30 giây
    if (role !== "HLV" && role !== "ADMIN") return;
    const timer = setInterval(() => { loadBookings(); }, 30000);
    return () => clearInterval(timer);
  }, [role]);
  const [bookings,setBookings]=useState<BookingRecord[]>([
    {id:"GP-230926-017",memberId:"HV00125",memberName:"Nguyễn Văn Minh",trainerId:"PT001",trainerName:"Nguyễn Minh Hoàng",type:"Tập sức mạnh",day:"Thứ Tư 23",time:"17:00",status:"Đã xác nhận",note:"Tập trung kỹ thuật ngực"},
    {id:"GP-240926-021",memberId:"HV00124",memberName:"Trần Thị Ngọc",trainerId:"PT001",trainerName:"Nguyễn Minh Hoàng",type:"Cardio",day:"Thứ Năm 24",time:"18:00",status:"Chờ xác nhận",note:"Buổi đầu tiên"},
  ]);
  const [userId,setUserId]=useState("");
  const support=useApi<{open:number}>(role==="ADMIN"?"/tickets/summary":null);
  useEffect(()=>{if(role==="ADMIN")support.reload()},[page]);
  const currentMember=members.find(member=>member.id===currentMemberId)??members[0];
  const currentTrainer=trainerAccounts.find(trainer=>trainer.id===currentTrainerId)??trainerAccounts[0];
  const selectedMember=members.find(member=>member.id===selectedMemberId)??members[0];
  const confirmBooking = (nextBooking: BookingDetails) => {
    setBooking(nextBooking);
  };
  const registerMember=async(member:Member):Promise<string|null>=>{
    try{
      await api.post("/auth/register",{fullName:member.name,email:member.email,phone:member.phone,password:member.password,dob:viDateToIso(member.birthDate)??undefined,gender:member.gender,goal:member.goal});
    }catch(e:any){
      return e?.message||"Không thể đăng ký tài khoản.";
    }
    setAuthNotice("Đăng ký tài khoản thành công! Vui lòng đăng nhập để sử dụng hệ thống.");
    setPage("login");
    return null;
  };
  const login=async(email:string,password:string):Promise<string|null>=>{
    setAuthNotice("");
    try{
      const r=await api.post("/auth/login",{email,password});
      setUserId(String(r.user.id??r.user._id));
      if(r.user.role==="admin"){
        api.setToken(r.token);
        const list=await api.get("/members?limit=200");
        setMembers(list.items.map(fromApiMember));
        await loadTrainers();
        await loadBookings();
        setRole("ADMIN");
        setCurrentMemberId(null);
        setCurrentTrainerId(null);
        setPage("admin-dashboard");
        return null;
      }
      if(r.user.role==="trainer"){
        api.setToken(r.token);
        const t=fromApiTrainer(await api.get("/trainers/me/profile"));
        setTrainerAccounts([t]);
        setCurrentTrainerId(t.id);
        await loadBookings();
        await loadAssigned();
        setRole("HLV");
        setCurrentMemberId(null);
        setPage("trainer-dashboard");
        return null;
      }
      if(r.user.role==="member"){
        api.setToken(r.token);
        const me=await api.get("/members/me");
        const mapped=fromApiMember({...me,accountStatus:"Đang hoạt động"});
        setMembers([mapped]);
        setCurrentMemberId(mapped.id);
        setCurrentTrainerId(null);
        setRole("HỘI VIÊN");
        setPage("dashboard");
        return null;
      }
      api.setToken(null);
      return "Tài khoản này không có quyền đăng nhập vào hệ thống. Vui lòng dùng tài khoản Admin, HLV hoặc Hội viên.";
    }catch(e:any){
      api.setToken(null);
      return e?.message||"Không thể đăng nhập.";
    }
  };
  const logout=()=>{
    api.post("/auth/logout").catch(()=>{});
    api.setToken(null);
    setRole(null);
    setCurrentMemberId(null);
    setCurrentTrainerId(null);
    setAuthNotice("");
    setMembers([]);
    setBookings([]);
    setTrainerAccounts([]);
    setAssignedMembers([]);
    setPage("login");
  };
  const loadTrainers=async()=>{
    try{const list=await api.get("/trainers");setTrainerAccounts(list.map(fromApiTrainer));}catch{/* bỏ qua */}
  };
  const loadBookings=async()=>{
    try{const list=await api.get("/appointments?sort=asc");setBookings(list.map(fromApiAppt));}catch{/* bỏ qua */}
  };
  const loadAssigned=async()=>{
    try{
      const list=await api.get("/members/assigned");
      setAssignedMembers(list.map(fromApiAssigned));
      setTrainerAccounts(prev=>prev.map(t=>({...t,members:list.length})));
    }catch{/* bỏ qua */}
  };
  // Admin thêm/khóa HLV: cập nhật giao diện ngay và lưu lên server; lỗi thì báo và tải lại dữ liệu thật
  const syncTrainers=async(next:Trainer[])=>{
    const prev=trainerAccounts;
    setTrainerAccounts(next);
    try{
      for(const item of next){
        const old=prev.find(x=>x.id===item.id);
        if(!old){
          const pk=await api.get("/packages");
          await api.post("/trainers",{code:item.id,fullName:item.name,email:item.email.trim().toLowerCase(),phone:item.phone,expertise:item.specialty,password:"Trainer@123",packageIds:pk.map((x:any)=>x._id)});
        }else if(old.status!==item.status&&old._id){
          await api.patch(`/trainers/${old._id}`,{isActive:item.status==="Đang hoạt động"});
        }
      }
    }catch(e:any){
      alert(e?.message||"Không lưu được thay đổi HLV");
    }
    await loadTrainers();
  };
  const reloadMembers=async()=>{
    try{const list=await api.get("/members?limit=200");setMembers(list.items.map(fromApiMember));}catch{/* bỏ qua */}
  };
  // Cập nhật giao diện ngay, đồng thời lưu thay đổi lên server; nếu lỗi thì báo và tải lại dữ liệu thật
  const syncMembers=(next:Member[])=>{
    const prevList=members;
    setMembers(next);
    next.forEach(n=>{
      const p=prevList.find(x=>x.id===n.id);
      if(p&&JSON.stringify(p)!==JSON.stringify(n)) persistMemberChange(p,n).then(err=>{if(err){alert(err);reloadMembers()}});
    });
  };
  const updateMember=(next:Member)=>syncMembers(members.map(member=>member.id===next.id?next:member));
  if (!role && page === "register") return <Auth register setPage={setPage} members={members} onRegister={registerMember} onLogin={login}/>;
  if (!role) return <Auth setPage={setPage} members={members} onRegister={registerMember} onLogin={login} notice={authNotice}/>;
  const currentId=role==="ADMIN"?"ADMIN001":role==="HLV"?currentTrainer.id:currentMember.id;
  const currentName=role==="ADMIN"?"Lê Thu Hà":role==="HLV"?currentTrainer.name:currentMember.name;
  const refreshMe=async()=>{try{const me=await api.get("/members/me");setMembers([fromApiMember({...me,accountStatus:"Đang hoạt động"})])}catch{}};
  const changeBookingStatus=async(id:string,status:BookingRecord["status"])=>{
    try{
      if(status==="Đã xác nhận") await api.post(`/appointments/${id}/confirm`);
      else if(status==="Bị từ chối"){
        const reason=window.prompt("Lý do từ chối yêu cầu (hội viên sẽ được hoàn lại buổi PT):","Khung giờ này tôi không thể nhận lịch");
        if(reason===null) return;
        if(!reason.trim()){alert("Vui lòng nhập lý do từ chối.");return}
        await api.post(`/appointments/${id}/reject`,{reason:reason.trim()});
      }else{alert("Trạng thái này được cập nhật khi Admin check-in cho hội viên.");return}
    }catch(e:any){
      alert(e?.message||"Không cập nhật được lịch hẹn");
    }
    await loadBookings();
    if(role==="HLV") await loadAssigned();
  };
  const updateMembersWithLog=(next:Member[])=>syncMembers(next);
  const adminOnly:Page[]=["admin-dashboard","members","member-detail","trainer-management","checkin-history","checkin-duplicates","checkin-report","checkin-rules","activity"];
  const trainerOnly:Page[]=["trainer-dashboard","assigned-members"];
  if(role==="HỘI VIÊN"&&adminOnly.includes(page)){
    return <Shell page="dashboard" setPage={setPage} role={role} accountName={currentMember.name} onLogout={logout}><Dashboard setPage={setPage} member={currentMember}/></Shell>;
  }
  if(role!=="HLV"&&trainerOnly.includes(page)){
    const fallback=role==="ADMIN"?"admin-dashboard":"dashboard";
    return <Shell page={fallback} setPage={setPage} role={role} accountName={currentName} onLogout={logout}><Card className="p-10 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-600"><Icon name="lock" size={24}/></span><h1 className="mt-4 text-xl font-bold">Không có quyền truy cập</h1><p className="mt-2 text-sm text-slate-500">Màn hình này chỉ dành cho tài khoản Huấn luyện viên.</p><Button onClick={()=>setPage(fallback)} className="mt-5">Quay về tổng quan</Button></Card></Shell>;
  }
  let content: ReactNode;
  switch (page) {
    case "dashboard": content=<Dashboard setPage={setPage} member={currentMember}/>; break;
    case "booking": content=<Booking setPage={setPage} onConfirm={confirmBooking} member={currentMember}/>; break;
    case "success": content=<Success setPage={setPage} booking={booking}/>; break;
    case "schedule": content=<Schedule setPage={setPage}/>; break;
    case "trainers": content=<Trainers setPage={setPage}/>; break;
    case "trainer-detail": content=<TrainerDetail setPage={setPage}/>; break;
    case "plans": content=role==="HLV"?<TrainerPlans members={assignedMembers} setPage={setPage}/>:<Plans setPage={setPage}/>; break;
    case "workout": content=<Workout setPage={setPage}/>; break;
    case "progress": content=<Progress setPage={setPage}/>; break;
    case "membership": content=<Membership member={currentMember} setPage={setPage} onPurchased={refreshMe}/>; break;
    case "notifications": content=<NotificationCenter setPage={setPage}/>; break;
    case "profile": content=role==="HLV"?<TrainerProfile trainer={currentTrainer} onSaved={(t)=>setTrainerAccounts([t])}/>:<Profile member={currentMember} onSaved={(m)=>setMembers(members.map(x=>x.id===m.id?m:x))}/>; break;
    case "my-checkins": content=<MyCheckins member={currentMember}/>; break;
    case "admin-dashboard": content=<AdminDashboard members={members} trainerCount={trainerAccounts.length} supportCount={support.data?.open??0} setPage={setPage} onSelect={setSelectedMemberId}/>; break;
    case "members": content=<MemberManagement members={members} setMembers={updateMembersWithLog} setPage={setPage} onSelect={setSelectedMemberId}/>; break;
    case "trainer-management": content=<TrainerManagement trainers={trainerAccounts} setTrainers={syncTrainers} setPage={setPage}/>; break;
    case "trainer-dashboard": content=<TrainerDashboard trainer={currentTrainer} bookings={bookings} onStatus={changeBookingStatus} onComplete={setCompleting} setPage={setPage}/>; break;
    case "trainer-schedule": content=<TrainerSchedule bookings={role==="ADMIN"?bookings:bookings.filter(item=>item.trainerId===currentTrainer.id)} role={role} trainers={trainerAccounts} onStatus={changeBookingStatus} onComplete={setCompleting} onSlotsChanged={()=>{}}/>; break;
    case "assigned-members": content=<AssignedMembers members={assignedMembers} setPage={setPage}/>; break;
    case "messages": content=<MessageCenter meId={userId} role={role}/>; break;
    case "support": content=<SupportCenter meId={userId} meName={currentName} role={role}/>; break;
    case "activity": content=<ActivityLogs/>; break;
    case "member-detail": content=<MemberDetail member={selectedMember} members={members} onBack={()=>setPage("members")} onUpdate={updateMember}/>; break;
    case "checkin": content=<CheckinNew/>; break;
    case "checkin-history": content=<CheckinHistory/>; break;
    case "checkin-duplicates": content=<DuplicateManagement setPage={setPage}/>; break;
    case "checkin-report": content=<CheckinReport/>; break;
    case "checkin-rules": content=<CheckinRules/>; break;
    default: content=role==="ADMIN"?<AdminDashboard members={members} trainerCount={trainerAccounts.length} supportCount={support.data?.open??0} setPage={setPage} onSelect={setSelectedMemberId}/>:role==="HLV"?<TrainerDashboard trainer={currentTrainer} bookings={bookings} onStatus={changeBookingStatus} onComplete={setCompleting} setPage={setPage}/>:<Dashboard setPage={setPage} member={currentMember}/>;
  }
  return <Shell page={page} setPage={setPage} role={role} accountName={currentName} onLogout={logout}>{content}{completing&&<CompleteSessionModal booking={completing} onClose={()=>setCompleting(null)} onDone={async()=>{setCompleting(null);await loadBookings()}}/>}</Shell>;
}
