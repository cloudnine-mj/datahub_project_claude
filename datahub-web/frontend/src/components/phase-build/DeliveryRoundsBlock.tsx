// 2단계 / 블록 2 — 중간 수령·검수 회차 목록.
//   회차별 카드를 3가지 상태로 렌더: completed(0.5px 테두리) / in-progress(brand 강조) / pending(점선).
//   in-progress 카드는 검수 시작 버튼 + 진행률 바.
//   예정 회차가 2개 이상이면 가로 2열, 1개면 1열.

"use client";

import { ArrowRight, Package } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseStatusBadge } from "@/components/PhaseStatusBadge";

export type RoundStatus = "completed" | "in-progress" | "pending";

export interface DeliveryRound {
  roundNumber: number;
  status: RoundStatus;
  deliveryDate: string;
  inspectionDeadline?: string;
  inspector?: string;
  inspectionResult?: "passed" | "failed";
  details: string;
  /** 0-100. in-progress 일 때만 의미 있음. */
  inspectionProgress?: number;
}

interface Props {
  rounds: DeliveryRound[];
  /** 우측 트레일 텍스트 — 예: '2/4회차 진행 중' */
  trailingLabel?: string;
  /** 신청자만 검수 시작 가능 */
  canInspect?: boolean;
}

export function DeliveryRoundsBlock({ rounds, trailingLabel, canInspect = true }: Props) {
  if (rounds.length === 0) {
    return (
      <PhaseBlock icon={Package} title="중간 수령·검수">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          아직 수령 회차가 등록되지 않았습니다
        </p>
      </PhaseBlock>
    );
  }

  const activeRounds = rounds.filter((r) => r.status !== "pending");
  const pendingRounds = rounds.filter((r) => r.status === "pending");

  return (
    <PhaseBlock
      icon={Package}
      title="중간 수령·검수"
      trailing={
        trailingLabel ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">{trailingLabel}</span>
        ) : undefined
      }
    >
      <div className="space-y-2">
        {activeRounds.map((r) => (
          <RoundCard key={r.roundNumber} round={r} canInspect={canInspect} />
        ))}
      </div>
      {pendingRounds.length > 0 && (
        <div
          className={`mt-2 grid gap-2 ${
            pendingRounds.length >= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {pendingRounds.map((r, idx) => (
            <PendingRoundCard
              key={r.roundNumber}
              round={r}
              isFinal={idx === pendingRounds.length - 1 && pendingRounds.length >= 2}
            />
          ))}
        </div>
      )}
    </PhaseBlock>
  );
}

function RoundCard({ round, canInspect }: { round: DeliveryRound; canInspect: boolean }) {
  if (round.status === "completed") {
    const resultLabel =
      round.inspectionResult === "passed"
        ? " · 통과"
        : round.inspectionResult === "failed"
        ? " · 보류"
        : "";
    return (
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <PhaseStatusBadge variant="success">
              {round.roundNumber}회차 완료
            </PhaseStatusBadge>
            <span className="text-gray-900 dark:text-gray-100">
              {round.deliveryDate} 납품
            </span>
          </div>
          {round.inspector && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              검수자: {round.inspector}
              {resultLabel}
            </div>
          )}
        </div>
        {round.details && (
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{round.details}</p>
        )}
      </div>
    );
  }

  // in-progress
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <PhaseStatusBadge variant="info">
            {round.roundNumber}회차 검수 중
          </PhaseStatusBadge>
          <span className="text-red-700 dark:text-red-300">
            {round.deliveryDate} 납품
            {round.inspectionDeadline && ` · 검수 마감 ${round.inspectionDeadline}`}
          </span>
        </div>
        {canInspect && (
          <button
            type="button"
            onClick={() => console.log("[stub] 검수 시작", round.roundNumber)}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-gray-50 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-gray-800"
          >
            검수 시작
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      {round.details && (
        <p className="mt-1.5 text-xs text-red-700/80 dark:text-red-300/80">
          {round.details}
        </p>
      )}
      {typeof round.inspectionProgress === "number" && (
        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-red-100 dark:bg-red-900/30">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${round.inspectionProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PendingRoundCard({
  round,
  isFinal,
}: {
  round: DeliveryRound;
  isFinal: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-3 text-center dark:border-gray-700">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {round.roundNumber}회차 {isFinal && "최종 "}(예정)
      </p>
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
        {round.deliveryDate}
      </p>
    </div>
  );
}
