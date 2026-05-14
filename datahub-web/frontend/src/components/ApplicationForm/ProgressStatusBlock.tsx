// 진행 상태 블록 — 상단 가로 타임라인 + 하단 collapsible 진행 이력.
//   draft 상태에서는 렌더되지 않음 (상위에서 분기).
//   완료 노드 = 녹색 + 체크, 현재 노드 = brand red + 숫자, 대기 = 회색 + 숫자.

import { Check } from "lucide-react";
import type {
  ApplicationStatus,
  HistoryAction,
  StatusHistoryItem,
} from "@/lib/applicationFormConfig";

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
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">진행 상태</h2>
        <StatusBadge status={status} />
      </header>

      <ol className="grid grid-cols-4">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const matchedHistory = history.find((h) => h.action === step.action);

          const nodeClass = isDone
            ? "bg-[#1D9E75] text-white"
            : isCurrent
            ? "bg-brand text-white"
            : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400";

          const labelClass =
            isDone || isCurrent
              ? "font-medium text-gray-900 dark:text-gray-100"
              : "text-gray-400 dark:text-gray-500";

          // 노드 좌우 연결선 — 첫 항목은 좌측 없음, 마지막은 우측 없음.
          const leftLineClass =
            i > 0
              ? i <= currentIdx
                ? "bg-[#1D9E75]"
                : "bg-gray-200 dark:bg-gray-700"
              : "bg-transparent";
          const rightLineClass =
            i < STEPS.length - 1
              ? i < currentIdx
                ? "bg-[#1D9E75]"
                : "bg-gray-200 dark:bg-gray-700"
              : "bg-transparent";

          return (
            <li
              key={step.id}
              className="relative flex flex-col items-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className={`absolute left-0 right-1/2 top-3 h-0.5 ${leftLineClass}`} />
              <span className={`absolute left-1/2 right-0 top-3 h-0.5 ${rightLineClass}`} />
              <div
                className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-[11px] font-medium ${nodeClass}`}
              >
                {isDone ? <Check size={14} aria-hidden="true" /> : <span>{i + 1}</span>}
              </div>
              <p className={`mt-1.5 text-[11px] ${labelClass}`}>{step.label}</p>
              {matchedHistory && (
                <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                  {matchedHistory.timestamp}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <details className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>진행 이력 {history.length}건</span>
          <span className="text-gray-400 dark:text-gray-500">
            승인 주체: Data Governance Team
          </span>
        </summary>
        <ol className="mt-3 space-y-2 border-l border-gray-100 pl-3 dark:border-gray-800">
          {/* 최신순(역순) 정렬 */}
          {history
            .slice()
            .reverse()
            .map((h) => (
              <HistoryRow key={h.id} item={h} />
            ))}
        </ol>
      </details>
    </section>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        제출됨
      </span>
    );
  }
  if (status === "reviewing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
        검토 중
      </span>
    );
  }
  // approved
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
      승인 완료
    </span>
  );
}

function HistoryRow({ item }: { item: StatusHistoryItem }) {
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"
      />
      <p className="text-xs">
        <span className="font-medium text-gray-800 dark:text-gray-200">{item.action}</span>
        <span className="ml-1 text-gray-400 dark:text-gray-500">
          · {item.timestamp} · {item.actor} ({item.actorRole})
        </span>
      </p>
      {item.comment && (
        <p className="mt-1 rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
          {item.comment}
        </p>
      )}
    </li>
  );
}
