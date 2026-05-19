// 진행 상태 카드 — 가로 4단계 타임라인 + '승인 주체' footer.
//   진행 이력은 별도 카드(ProgressHistoryBlock) 로 분리됨.
//   완료 노드 = 녹색 + 체크, 현재 노드 = brand red + 숫자, 대기 = 흰 배경 + 회색 테두리.

import { Check, UserRound } from "lucide-react";
import type {
  ApplicationStatus,
  HistoryAction,
  StatusHistoryItem,
} from "@/lib/governance/forms/application-config";

interface StepDef {
  id: string;
  label: string;
  action: HistoryAction;
}

const STEPS: StepDef[] = [
  { id: "draft", label: "임시 저장", action: "임시 저장" },
  { id: "submitted", label: "제출됨", action: "제출됨" },
  { id: "reviewing", label: "검토 중", action: "검토 시작" },
  { id: "approved", label: "승인 완료", action: "승인 완료" },
];

const STATUS_INDEX: Record<ApplicationStatus, number> = {
  draft: 0,
  submitted: 1,
  reviewing: 2,
  approved: 3,
};

interface Props {
  status: ApplicationStatus;
  history: StatusHistoryItem[];
}

export function ProgressStatusBlock({ status, history }: Props) {
  if (status === "draft") return null;

  const currentIdx = STATUS_INDEX[status];

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-5 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">진행 상태</h2>
        <StatusBadge status={status} />
      </header>

      <ol className="grid grid-cols-4">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const matched = history.find((h) => h.action === step.action);

          const nodeClass = isDone
            ? "bg-[#1D9E75] text-white border-transparent"
            : isCurrent
            ? "bg-brand text-white border-transparent"
            : "bg-white text-gray-400 border border-gray-200 dark:bg-gray-900 dark:text-gray-500 dark:border-gray-700";

          const labelClass =
            isDone || isCurrent
              ? "font-medium text-gray-900 dark:text-gray-100"
              : "text-gray-400 dark:text-gray-500";

          const leftLine =
            i > 0
              ? i <= currentIdx
                ? "bg-[#1D9E75]"
                : "bg-gray-200 dark:bg-gray-700"
              : "bg-transparent";
          const rightLine =
            i < STEPS.length - 1
              ? i < currentIdx
                ? "bg-[#1D9E75]"
                : "bg-gray-200 dark:bg-gray-700"
              : "bg-transparent";

          // 노드 아래 표시 — 완료 단계는 timestamp, 현재는 '진행 중', 대기는 빈 공간.
          const subText = isDone && matched
            ? matched.timestamp
            : isCurrent
            ? "진행 중"
            : null;

          return (
            <li
              key={step.id}
              className="relative flex flex-col items-center"
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${step.label}${
                isDone ? " 완료" : isCurrent ? " 진행 중" : " 대기"
              }`}
            >
              <span aria-hidden="true" className={`absolute left-0 right-1/2 top-3.5 h-0.5 ${leftLine}`} />
              <span aria-hidden="true" className={`absolute left-1/2 right-0 top-3.5 h-0.5 ${rightLine}`} />
              <div
                className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-[12px] font-medium ${nodeClass}`}
              >
                {isDone ? <Check size={14} aria-hidden="true" /> : <span>{i + 1}</span>}
              </div>
              <p className={`mt-2 text-[12px] ${labelClass}`}>{step.label}</p>
              {subText && (
                <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                  {subText}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-center gap-2 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
        <UserRound size={14} aria-hidden="true" className="text-gray-400 dark:text-gray-500" />
        <span>
          승인 주체:{" "}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Data Governance Team
          </span>
        </span>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        제출됨
      </span>
    );
  }
  if (status === "reviewing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
        검토 중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
      승인 완료
    </span>
  );
}
