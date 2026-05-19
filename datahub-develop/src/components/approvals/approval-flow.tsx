"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApprovalRequestWithSteps } from "@/types";

interface ApprovalFlowProps {
  request: ApprovalRequestWithSteps;
}

export function ApprovalFlow({ request }: ApprovalFlowProps) {
  const steps = request.steps ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>결재 유형: {request.config?.type ?? "-"}</span>
        <span>·</span>
        <span>상태: {statusLabel(request.status)}</span>
      </div>
      <div className="flex items-start gap-0">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-start">
            <div className="flex flex-col items-center">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2",
                step.status === "APPROVED" && "border-green-500 bg-green-50",
                step.status === "REJECTED" && "border-red-500 bg-red-50",
                step.status === "PENDING" && "border-gray-300 bg-gray-50",
              )}>
                {step.status === "APPROVED" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                {step.status === "REJECTED" && <XCircle className="h-5 w-5 text-red-600" />}
                {step.status === "PENDING" && <Clock className="h-5 w-5 text-gray-400" />}
              </div>
              <div className="mt-2 text-center">
                <p className="text-sm font-medium">{step.approver?.name ?? "알 수 없음"}</p>
                <p className="text-xs text-muted-foreground">Step {step.stepOrder}</p>
                {step.comment && (
                  <p className="mt-1 text-xs text-muted-foreground max-w-[120px] truncate">{step.comment}</p>
                )}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className="mx-2 mt-4 h-0.5 w-12 bg-gray-200" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "대기",
    IN_PROGRESS: "진행 중",
    APPROVED: "승인",
    REJECTED: "반려",
  };
  return map[status] ?? status;
}
