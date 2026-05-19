// 페이지 하단 액션 버튼 — 이전 단계 보기(secondary) / 다음 단계로 진행(primary).
//   Stepper 클릭은 '재조회' 용, 이 버튼은 '정식 진행' 용으로 역할 분리.
//
//   - prevPath 있을 때만 이전 버튼 노출 (완료된 이전 단계가 있을 때).
//   - nextLabel 있으면 다음 버튼 노출. canProceed=false 또는 nextPath 미설정 시 disabled.
//   - 둘 다 없으면 null 반환 — 렌더되지 않음.
//
//   폰트 weight 는 400/500 만 (font-medium 까지).

"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface Props {
  prevPath?: string;
  prevLabel?: string;
  nextPath?: string;
  nextLabel?: string;
  /** 다음 단계 진행 조건 충족 여부 — false 면 다음 버튼 disabled. */
  canProceed?: boolean;
}

const PRIMARY_ENABLED =
  "bg-brand text-white hover:bg-brand-dark transition";
const PRIMARY_DISABLED =
  "bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500";
const SECONDARY =
  "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

export function StepActions({
  prevPath,
  prevLabel = "이전 단계 보기",
  nextPath,
  nextLabel,
  canProceed = true,
}: Props) {
  if (!prevPath && !nextLabel) return null;

  const proceedEnabled = canProceed && !!nextPath;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
      {prevPath && (
        <Link
          href={prevPath}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${SECONDARY}`}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {prevLabel}
        </Link>
      )}
      {nextLabel &&
        (proceedEnabled && nextPath ? (
          <Link
            href={nextPath}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${PRIMARY_ENABLED}`}
          >
            {nextLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${PRIMARY_DISABLED}`}
          >
            {nextLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        ))}
    </div>
  );
}
