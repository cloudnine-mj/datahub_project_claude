"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

const ttL:Record<string,string>={PROJECT:"프로젝트",LAB:"랩",TECH_CELL:"테크셀"};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  useEffect(() => { fetch("/api/budgets").then(r=>r.ok?r.json():[]).then(d=>setBudgets(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setLoading(false)); }, []);
  const filtered = budgets.filter(b=>typeFilter==="ALL"||b.targetType===typeFilter);
  return (<div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">예산 관리</h1><p className="text-gray-500">프로젝트/랩/테크셀별 예산 현황을 조회합니다.</p></div>
    <div className="flex items-center gap-4">
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-40"><SelectValue placeholder="대상 유형"/></SelectTrigger>
        <SelectContent><SelectItem value="ALL">전체</SelectItem><SelectItem value="PROJECT">프로젝트</SelectItem><SelectItem value="LAB">랩</SelectItem><SelectItem value="TECH_CELL">테크셀</SelectItem></SelectContent>
      </Select>
    </div>
    <Card><CardHeader><CardTitle>예산 현황</CardTitle></CardHeader><CardContent>
      {loading?<p className="text-center py-8 text-gray-500">불러오는 중...</p>:filtered.length===0?<p className="text-center py-8 text-gray-500">예산 데이터가 없습니다.</p>:(
      <Table><TableHeader><TableRow>
        <TableHead>대상</TableHead><TableHead>분기</TableHead><TableHead className="text-right">예산</TableHead><TableHead className="text-right">사용액</TableHead><TableHead className="text-right">잔액</TableHead><TableHead>사용률</TableHead>
      </TableRow></TableHeader><TableBody>
        {filtered.map(b=>{
          const remaining=b.totalAmount-b.usedAmount;
          const rate=b.totalAmount>0?Math.round((b.usedAmount/b.totalAmount)*100):0;
          const name=b.project?.name||b.lab?.name||b.techCell?.name||b.targetId;
          return (<TableRow key={b.id}>
            <TableCell><div><span className="font-medium">{name}</span><span className="text-xs text-gray-400 ml-2">{ttL[b.targetType]}</span></div></TableCell>
            <TableCell>{b.quarter}</TableCell>
            <TableCell className="text-right">{formatCurrency(b.totalAmount)}</TableCell>
            <TableCell className="text-right">{formatCurrency(b.usedAmount)}</TableCell>
            <TableCell className="text-right">{formatCurrency(remaining)}</TableCell>
            <TableCell><div className="flex items-center gap-2"><div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full rounded-full ${rate>80?"bg-red-500":rate>50?"bg-yellow-500":"bg-green-500"}`} style={{width:`${rate}%`}}/></div><span className="text-sm">{rate}%</span></div></TableCell>
          </TableRow>);})}
      </TableBody></Table>)}
    </CardContent></Card></div>);
}
