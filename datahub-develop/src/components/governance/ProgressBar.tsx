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

/** Phase 1 — 5단계 진행은 form status 와 무관한 별도 상태로 관리.
 *  신청 단계(0) 에서 총괄 담당자가 실무자 지정 후 [협의 단계로] 버튼을 눌러야
 *  1(협의) 로 넘어가는 흐름. 백엔드 컬럼이 없으므로 sessionStorage 에 영속.
 *  status === 'approved' 면 종료(4) 로 고정.
 *
 *  Phase 2 에서 GovernanceForm 에 serviceStage 컬럼 추가 + API 로 교체 예정. */
const STAGE_KEY = (formId: string) => `dh:gov:service-stage:${formId}`;

export function readServiceStage(formId: string, status: string): number {
  if (status === "approved") return 4;
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(STAGE_KEY(formId));
    if (raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(4, n));
  } catch {
    return 0;
  }
}

export function writeServiceStage(formId: string, stage: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STAGE_KEY(formId),
      String(Math.max(0, Math.min(4, stage))),
    );
  } catch {
    /* ignore */
  }
}

/** @deprecated readServiceStage 로 대체. status 만으로는 단계를 결정하지 않음.
 *  하위 호환을 위해 남겨두지만 새 코드에서는 사용 금지. */
export function serviceStageIndexFromStatus(status: string): number {
  return status === "approved" ? 4 : 0;
}
