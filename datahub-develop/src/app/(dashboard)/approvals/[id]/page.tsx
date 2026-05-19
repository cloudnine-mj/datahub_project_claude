"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Check, X } from "lucide-react";

const stepStatus: Record<string,string> = {PENDING:"대기",APPROVED:"승인",REJECTED:"반려"};
const stepColor: Record<string,string> = {PENDING:"bg-gray-200 text-gray-700",APPROVED:"bg-green-500 text-white",REJECTED:"bg-red-500 text-white"};

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [approval, setApproval] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/approvals/${params.id}`).then(r=>r.ok?r.json():null).then(d=>setApproval(d)).catch(()=>{}).finally(()=>setLoading(false));
  }, [params.id]);

  const handleAction = async (action: "APPROVED"|"REJECTED") => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/approvals/${params.id}`, {
        method: "PUT", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ status: action, comment }),
      });
      if (res.ok) {
        const updated = await fetch(`/api/approvals/${params.id}`);
        if (updated.ok) setApproval(await updated.json());
        setComment("");
      } else { const err = await res.json(); alert(err.error||"처리에 실패했습니다."); }
    } catch { alert("오류가 발생했습니다."); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">불러오는 중...</p></div>;
  if (!approval) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">결재 요청을 찾을 수 없습니다.</p></div>;
  const isPlan = !!approval.planId;
  const target = isPlan ? approval.plan : approval.report;
  return (<div className="space-y-6 max-w-4xl">
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={()=>router.back()}><ArrowLeft className="h-4 w-4"/></Button>
      <div><h1 className="text-2xl font-bold">결재 상세</h1><p className="text-gray-500">{isPlan?"기획서":"보고서"} 결재 요청</p></div>
    </div>
    <Card><CardHeader><CardTitle>{isPlan?"기획서":"보고서"} 요약</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between"><span className="text-sm text-gray-500">제목</span><span className="text-sm font-medium">{target?.dataName??"-"}</span></div>
        <Separator/>
        <div className="flex justify-between"><span className="text-sm text-gray-500">작성자</span><span className="text-sm font-medium">{target?.author?.name??"-"}</span></div>
        <Separator/>
        <div className="flex justify-between"><span className="text-sm text-gray-500">상태</span><Badge variant="outline">{approval.status}</Badge></div>
      </CardContent></Card>
    <Card><CardHeader><CardTitle>결재 흐름</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {approval.steps?.map((step:any, i:number) => (
            <div key={step.id} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-0.5 bg-gray-300"/>}
              <div className="flex flex-col items-center gap-1 min-w-[80px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${stepColor[step.status]??"bg-gray-200"}`}>
                  {step.stepOrder}
                </div>
                <span className="text-xs font-medium">{step.approver?.name??`Step ${step.stepOrder}`}</span>
                <span className="text-xs text-gray-500">{stepStatus[step.status]??step.status}</span>
                {step.comment && <span className="text-xs text-gray-400 italic">{step.comment}</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent></Card>
    {(approval.status==="PENDING"||approval.status==="IN_PROGRESS") && (
      <Card><CardHeader><CardTitle>결재 처리</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>코멘트</Label>
            <Textarea placeholder="코멘트를 입력하세요 (선택)" value={comment} onChange={e=>setComment(e.target.value)}/>
          </div>
          <div className="flex gap-3">
            <Button onClick={()=>handleAction("APPROVED")} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              <Check className="mr-1 h-4 w-4"/>승인
            </Button>
            <Button variant="destructive" onClick={()=>handleAction("REJECTED")} disabled={submitting}>
              <X className="mr-1 h-4 w-4"/>반려
            </Button>
          </div>
        </CardContent></Card>
    )}
  </div>);
}
