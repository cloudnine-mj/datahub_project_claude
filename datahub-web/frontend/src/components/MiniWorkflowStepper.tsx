"use client";

// 컴팩트 워크플로우 스텝퍼 — '내 문서 목록' 같은 표 row 안에 끼워 넣는
// 작은 진행 인디케이터. 라벨은 현재 단계만, 점/연결선은 작게.
//
// 풀 버전은 components/FormStatusPanel.tsx 의 WorkflowStepper.
// (4단계: 임시 저장 → 제출됨 → 검토 중 → 승인 완료. 반려는 단독 칩.)

import { Check, X } from "lucide-react";
import type { FormStatus } from "@/lib/api";

const STEPS: { key: FormStatus; label: string }[] = [
  { key: "draft", label: "임시 저장" },
  { key: "submitted", label: "제출됨" },
  { key: "reviewing", label: "검토 중" },
  { key: "approved", label: "승인 완료" },
];

const ORDER_INDEX: Record<string, number> = {
  draft: 0,
  submitted: 1,
  reviewing: 2,
  approved: 3,
};

export function MiniWorkflowStepper({ status }: { status: FormStatus | string }) {
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
        <X size={10} strokeWidth={3} /> 반려
      </span>
    );
  }

  const currentIdx = ORDER_INDEX[status] ?? -1;
  const currentLabel =
    STEPS.find((s) => s.key === status)?.label ?? "알 수 없음";

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center">
        {STEPS.map((step, i) => {
          const reached = currentIdx >= i;
          const current = currentIdx === i;
          return (
            <span key={step.key} className="inline-flex items-center">
              <span
                title={step.label}
                className={
                  "grid place-items-center rounded-full transition " +
                  (current
                    ? "h-4 w-4 bg-blue-600 text-white"
                    : reached
                    ? "h-3 w-3 bg-blue-500 text-white"
                    : "h-3 w-3 bg-gray-200")
                }
              >
                {reached && !current && <Check size={8} strokeWidth={4} />}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className={
                    "h-0.5 w-3 " +
                    (currentIdx > i ? "bg-blue-500" : "bg-gray-200")
                  }
                />
              )}
            </span>
          );
        })}
      </div>
      <span
        className={
          "whitespace-nowrap text-xs font-semibold " +
          (status === "approved"
            ? "text-emerald-700"
            : currentIdx >= 0
            ? "text-blue-700"
            : "text-gray-500")
        }
      >
        {currentLabel}
      </span>
    </div>
  );
}
