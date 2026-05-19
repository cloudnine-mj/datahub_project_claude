"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Plan {
  id: string;
  dataName: string;
  status: string;
  createdAt: string;
  project?: { name: string };
  author?: { name: string; email: string };
}

const STATUS_OPTIONS = [
  { value: "ALL", label: "전체" },
  { value: "DRAFT", label: "작성 중" },
  { value: "APPROVED", label: "제출 완료" },
  { value: "IN_PROGRESS", label: "진행 중" },
  { value: "COMPLETED", label: "완료" },
];

const statusBadgeVariant: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-purple-100 text-purple-700",
};

const statusLabel: Record<string, string> = {
  DRAFT: "작성 중",
  APPROVED: "제출 완료",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
};

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function fetchPlans() {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (search) params.set("search", search);
        const res = await fetch(`/api/plans?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setPlans(Array.isArray(data) ? data : data.data ?? []);
        }
      } catch (error) {
        console.error("Failed to fetch plans:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, [statusFilter, search]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">레포지토리 생성</h1>
          <p className="text-gray-500">데이터 레포지토리를 생성하고 관리합니다.</p>
        </div>
        <Link href="/plans/new">
          <Button><Plus className="mr-2 h-4 w-4" />새 레포지토리</Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="레포지토리 검색..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="상태 필터" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-500">불러오는 중...</p>
          ) : plans.length === 0 ? (
            <p className="text-center py-8 text-gray-500">레포지토리가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제목 (데이터명)</TableHead>
                  <TableHead>프로젝트</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>작성자</TableHead>
                  <TableHead>작성일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id} className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/plans/${plan.id}`)}>
                    <TableCell className="font-medium">{plan.dataName}</TableCell>
                    <TableCell>{plan.project?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeVariant[plan.status] ?? ""}>
                        {statusLabel[plan.status] ?? plan.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{plan.author?.name ?? "-"}</TableCell>
                    <TableCell>{formatDate(plan.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
