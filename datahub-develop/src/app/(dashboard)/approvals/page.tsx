"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

const sL: Record<string,string> = {PENDING:"대기 중",IN_PROGRESS:"진행 중",APPROVED:"승인됨",REJECTED:"반려됨"};
const sC: Record<string,string> = {PENDING:"bg-yellow-100 text-yellow-700",IN_PROGRESS:"bg-blue-100 text-blue-700",APPROVED:"bg-green-100 text-green-700",REJECTED:"bg-red-100 text-red-700"};

export default function ApprovalsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/approvals").then(r=>r.ok?r.json():[]).then(d=>setItems(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);
  return (<div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">결재 관리</h1><p className="text-gray-500">결재 요청을 관리합니다.</p></div>
    <Card><CardHeader><CardTitle>결재 목록</CardTitle></CardHeader><CardContent>
      {loading?<p className="text-center py-8 text-gray-500">불러오는 중...</p>:items.length===0?<p className="text-center py-8 text-gray-500">결재 요청이 없습니다.</p>:(
      <Table><TableHeader><TableRow>
        <TableHead>유형</TableHead><TableHead>제목</TableHead><TableHead>발의자</TableHead><TableHead>요청일</TableHead><TableHead>상태</TableHead>
      </TableRow></TableHeader><TableBody>
        {items.map(a=>(<TableRow key={a.id} className="cursor-pointer hover:bg-gray-50" onClick={()=>router.push(`/approvals/${a.id}`)}>
          <TableCell>{a.planId?"기획서":"보고서"}</TableCell>
          <TableCell className="font-medium">{a.plan?.dataName||a.report?.dataName||"-"}</TableCell>
          <TableCell>{a.plan?.author?.name||a.report?.author?.name||"-"}</TableCell>
          <TableCell>{formatDate(a.createdAt)}</TableCell>
          <TableCell><Badge variant="outline" className={sC[a.status]}>{sL[a.status]??a.status}</Badge></TableCell>
        </TableRow>))}
      </TableBody></Table>)}
    </CardContent></Card></div>);
}
