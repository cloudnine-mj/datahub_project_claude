"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { ApprovalStep } from "@prisma/client";

interface ApprovalHistoryProps {
  steps: (ApprovalStep & { approver: { name: string | null; email: string } })[];
}

export function ApprovalHistory({ steps }: ApprovalHistoryProps) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{step.approver.name ?? step.approver.email}</span>
              <Badge variant={step.status === "APPROVED" ? "default" : step.status === "REJECTED" ? "destructive" : "secondary"}>
                {step.status === "APPROVED" ? "승인" : step.status === "REJECTED" ? "반려" : "대기"}
              </Badge>
            </div>
            {step.comment && <p className="mt-1 text-sm text-muted-foreground">{step.comment}</p>}
          </div>
          <span className="text-xs text-muted-foreground">
            {step.decidedAt ? formatDate(step.decidedAt) : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}
