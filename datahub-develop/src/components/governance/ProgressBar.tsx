// 신청서 상세 상단 진행 막대 — 막대 채우기형 (스타일 B).
//
//   ┌─────────────────────────────────────────────────────┐
//   │ 진행 상태                              계약 단계 · 3/5 │
//   │ ███████ ███████ ███████ ░░░░░░░ ░░░░░░░               │
//   │   신청     협의      계약     진행     종료              │
//   └─────────────────────────────────────────────────────┘
//
// 세그먼트 색:
//   - 완료(index < current): #1D9E75 녹색
//   - 현재(index === current): #D4533E 빨강
//   - 예정(index > current): 회색
//
// 라벨: 현재 단계 라벨만 #D4533E + 굵게 강조.

"use client";

interface Props {
  stages: string[];
  currentIndex: number;
}

function segmentClass(index: number, currentIndex: number): string {
  if (index < currentIndex) return "bg-[#1D9E75]";
  if (index === currentIndex) return "bg-[#D4533E]";
  return "bg-gray-200 dark:bg-gray-700";
}

export function ProgressBar({ stages, currentIndex }: Props) {
  const safeIndex = Math.max(0, Math.min(currentIndex, stages.length - 1));
  const currentName = stages[safeIndex] ?? "";
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
          진행 상태
        </span>
        <span className="text-[12px] font-medium text-[#D4533E]">
          {currentName} 단계 · {safeIndex + 1}/{stages.length}
        </span>
      </header>

      <div className="mb-2.5 flex gap-1">
        {stages.map((s, i) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded ${segmentClass(i, safeIndex)}`}
          />
        ))}
      </div>

      <div className="flex">
        {stages.map((s, i) => {
          const isCurrent = i === safeIndex;
          return (
            <span
              key={s}
              className={`flex-1 text-center text-[11px] ${
                isCurrent
                  ? "font-medium text-[#D4533E]"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {s}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** 용역 제작(data_production) 의 5단계. */
export const SERVICE_STAGES = ["신청", "협의", "계약", "진행", "종료"] as const;

/** form status → 5단계 인덱스 매핑.
 *   draft                 → 0 (신청)
 *   submitted             → 1 (협의)
 *   reviewing             → 1 (협의)
 *   info_requested        → 1 (협의, 보완 요청 회차)
 *   approved              → 4 (종료)
 *   rejected              → 0 (반려는 본 진행 막대에 표시 안 함 — 안전한 디폴트) */
export function serviceStageIndexFromStatus(status: string): number {
  switch (status) {
    case "draft":
      return 0;
    case "submitted":
    case "reviewing":
    case "info_requested":
      return 1;
    case "approved":
      return 4;
    default:
      return 0;
  }
}
