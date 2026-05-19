"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewReportPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    planId:"", actualPeriodStart:"", actualPeriodEnd:"", dataManagerId:"",
    actualCost:0, dataName:"", dataSize:"", dataQuantity:0, qualityManagerId:"",
    usageScope:"INTERNAL", storageLocation:"", needsMoreData:false, followUpPlan:"",
  });
  useEffect(() => {
    fetch("/api/plans?status=APPROVED&pageSize=100").then(r=>r.ok?r.json():[]).then(d=>{
      const items = Array.isArray(d)?d:d.data??[];
      const approved = items.filter((p:any)=>p.status==="APPROVED");
      setPlans(approved);
    }).catch(()=>{});
    fetch("/api/admin/users").then(r=>r.ok?r.json():[]).then(d=>setUsers(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);
  const h = (f:string,v:any) => setForm(p=>({...p,[f]:v}));
  const selectedPlan = plans.find(p=>p.id===form.planId);
  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const body = {...form, actualCost:Number(form.actualCost), dataQuantity:Number(form.dataQuantity),
        projectId: selectedPlan?.projectId,
        actualPeriodStart: form.actualPeriodStart?new Date(form.actualPeriodStart).toISOString():null,
        actualPeriodEnd: form.actualPeriodEnd?new Date(form.actualPeriodEnd).toISOString():null,
        dataManagerId:form.dataManagerId||null, qualityManagerId:form.qualityManagerId||null,
      };
      const res = await fetch("/api/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(res.ok){router.push("/reports")}else{const err=await res.json();alert(err.error||"보고서 생성에 실패했습니다.")}
    } catch{alert("오류가 발생했습니다.")} finally{setLoading(false)}
  };
  return (<div className="space-y-6 max-w-4xl">
    <div><h1 className="text-2xl font-bold text-gray-900">새 보고서 작성</h1><p className="text-gray-500">데이터 구축 보고서를 작성합니다.</p></div>
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card><CardHeader><CardTitle>기본 정보</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>연결 기획서</Label>
            <Select value={form.planId} onValueChange={v=>{h("planId",v);const p=plans.find(x=>x.id===v);if(p)h("dataName",p.dataName)}}>
              <SelectTrigger><SelectValue placeholder="기획서 선택"/></SelectTrigger>
              <SelectContent>{plans.map(p=><SelectItem key={p.id} value={p.id}>{p.dataName}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-2"><Label>프로젝트</Label><Input value={selectedPlan?.project?.name??""} disabled/></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>실제 시작일</Label><Input type="date" value={form.actualPeriodStart} onChange={e=>h("actualPeriodStart",e.target.value)}/></div>
          <div className="space-y-2"><Label>실제 종료일</Label><Input type="date" value={form.actualPeriodEnd} onChange={e=>h("actualPeriodEnd",e.target.value)}/></div>
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>데이터 정보</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>데이터명</Label><Input value={form.dataName} onChange={e=>h("dataName",e.target.value)} required/></div>
          <div className="space-y-2"><Label>데이터 크기</Label><Input value={form.dataSize} onChange={e=>h("dataSize",e.target.value)} placeholder="예: 10GB"/></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>데이터 수량</Label><Input type="number" value={form.dataQuantity} onChange={e=>h("dataQuantity",e.target.value)}/></div>
          <div className="space-y-2"><Label>실제 비용 (원)</Label><Input type="number" value={form.actualCost} onChange={e=>h("actualCost",e.target.value)}/></div>
        </div>
        <div className="space-y-2"><Label>저장 위치</Label><Input value={form.storageLocation} onChange={e=>h("storageLocation",e.target.value)}/></div>
        <div className="space-y-2"><Label>활용 범위</Label>
          <Select value={form.usageScope} onValueChange={v=>h("usageScope",v)}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="CONFIDENTIAL">기밀</SelectItem><SelectItem value="INTERNAL">내부용</SelectItem><SelectItem value="MODEL_SERVICE">모델/서비스</SelectItem></SelectContent>
          </Select></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>담당자</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>데이터 담당자</Label>
            <Select value={form.dataManagerId} onValueChange={v=>h("dataManagerId",v)}>
              <SelectTrigger><SelectValue placeholder="선택"/></SelectTrigger>
              <SelectContent>{users.map(u=><SelectItem key={u.id} value={u.id}>{u.name||u.email}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-2"><Label>품질 담당자</Label>
            <Select value={form.qualityManagerId} onValueChange={v=>h("qualityManagerId",v)}>
              <SelectTrigger><SelectValue placeholder="선택"/></SelectTrigger>
              <SelectContent>{users.map(u=><SelectItem key={u.id} value={u.id}>{u.name||u.email}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>후속 조치</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox id="needsMore" checked={form.needsMoreData} onCheckedChange={v=>h("needsMoreData",v)}/>
          <Label htmlFor="needsMore">추가 데이터 구축 필요</Label>
        </div>
        <div className="space-y-2"><Label>후속 계획</Label><Textarea value={form.followUpPlan} onChange={e=>h("followUpPlan",e.target.value)}/></div>
      </CardContent></Card>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={()=>router.back()}>취소</Button>
        <Button type="submit" disabled={loading}>{loading?"저장 중...":"보고서 저장"}</Button>
      </div>
    </form></div>);
}
