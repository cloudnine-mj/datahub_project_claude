"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { PlanWithRelations } from "@/types";

const statusLabels: Record<string, string> = {
  DRAFT: "초안",
  SUBMITTED: "제출됨",
  APPROVED: "승인",
  REJECTED: "반려",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
};

interface PlanTableProps {
  plans: PlanWithRelations[];
}

export function PlanTable({ plans }: PlanTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>데이터명</TableHead>
          <TableHead>프로젝트</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>작성자</TableHead>
          <TableHead>작성일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              기획서가 없습니다.
            </TableCell>
          </TableRow>
        ) : (
          plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell>
                <Link href={`/plans/${plan.id}`} className="font-medium text-blue-600 hover:underline">
                  {plan.dataName}
                </Link>
              </TableCell>
              <TableCell>{plan.project?.name ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={statusVariants[plan.status] ?? "secondary"}>
                  {statusLabels[plan.status] ?? plan.status}
                </Badge>
              </TableCell>
              <TableCell>{plan.author?.name ?? "-"}</TableCell>
              <TableCell>{formatDate(plan.createdAt)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
