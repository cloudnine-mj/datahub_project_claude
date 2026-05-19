"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { BudgetWithRecords } from "@/types";

const targetTypeLabels: Record<string, string> = {
  PROJECT: "프로젝트",
  LAB: "랩",
  TECH_CELL: "테크셀",
};

interface BudgetOverviewProps {
  budgets: BudgetWithRecords[];
  targetNames?: Record<string, string>;
}

export function BudgetOverview({ budgets, targetNames = {} }: BudgetOverviewProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>대상</TableHead>
          <TableHead>유형</TableHead>
          <TableHead>분기</TableHead>
          <TableHead className="text-right">예산</TableHead>
          <TableHead className="text-right">사용액</TableHead>
          <TableHead className="text-right">잔액</TableHead>
          <TableHead className="text-right">사용률</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {budgets.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              예산 데이터가 없습니다.
            </TableCell>
          </TableRow>
        ) : (
          budgets.map((budget) => {
            const remaining = budget.totalAmount - budget.usedAmount;
            const usageRate = budget.totalAmount > 0 ? (budget.usedAmount / budget.totalAmount) * 100 : 0;
            return (
              <TableRow key={budget.id}>
                <TableCell className="font-medium">{targetNames[budget.targetId] ?? budget.targetId}</TableCell>
                <TableCell>{targetTypeLabels[budget.targetType]}</TableCell>
                <TableCell>{budget.quarter} {budget.year}</TableCell>
                <TableCell className="text-right">{formatCurrency(budget.totalAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(budget.usedAmount)}</TableCell>
                <TableCell className="text-right">{formatCurrency(remaining)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${usageRate > 90 ? "bg-red-500" : usageRate > 70 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(usageRate, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm">{usageRate.toFixed(1)}%</span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
