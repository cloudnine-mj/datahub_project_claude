"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

const sL: Record<string,string> = {DRAFT:"작성 중",APPROVED:"제출 완료"};
const sC: Record<string,string> = {DRAFT:"bg-gray-100 text-gray-700",APPROVED:"bg-green-100 text-green-700"};

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/reports").then(r=>r.ok?r.json():[]).then(d=>setReports(Array.isArray(d)?d:d.data??[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);
  return (<div className="space-y-6">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-bold text-gray-900">보고서 관리</h1><p className="text-gray-500">데이터 구축 보고서를 관리합니다.</p></div>
      <Link href="/reports/new"><Button><Plus className="mr-2 h-4 w-4"/>새 보고서</Button></Link>
    </div>
    <Card><CardHeader><CardTitle>보고서 목록</CardTitle></CardHeader><CardContent>
      {loading?<p className="text-center py-8 text-gray-500">불러오는 중...</p>:reports.length===0?<p className="text-center py-8 text-gray-500">보고서가 없습니다.</p>:(
      <Table><TableHeader><TableRow>
        <TableHead>데이터명</TableHead><TableHead>프로젝트</TableHead><TableHead>상태</TableHead><TableHead>작성자</TableHead><TableHead>작성일</TableHead>
      </TableRow></TableHeader><TableBody>
        {reports.map(r=>(<TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={()=>router.push(`/reports/${r.id}`)}>
          <TableCell className="font-medium">{r.dataName}</TableCell>
          <TableCell>{r.project?.name??"-"}</TableCell>
          <TableCell><Badge variant="outline" className={sC[r.status]}>{sL[r.status]??r.status}</Badge></TableCell>
          <TableCell>{r.author?.name??"-"}</TableCell>
          <TableCell>{formatDate(r.createdAt)}</TableCell>
        </TableRow>))}
      </TableBody></Table>)}
    </CardContent></Card></div>);
}
