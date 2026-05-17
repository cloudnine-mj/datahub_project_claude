// 계획 수립 페이지 하단 안내 박스 — 좌측 안내 문구 + 우측 '신청서 작성으로' 버튼.
//   체크 여부와 무관하게 클릭 가능 (자기 점검 용도).
//   선택한 유형을 query param 으로 전달 → 신청서 작성 페이지에서 유형별 양식 자동 표시.

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PlanningType } from "@/lib/planningConfig";

interface Props {
  nextPath: string;
  /** 선택된 신청 유형 — query param 으로 다음 단계에 전달. */
  type: PlanningType;
}

export function PlanningFooter({ nextPath, type }: Props) {
  const hrefWithType = `${nextPath}?type=${type}`;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/40">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        모든 항목에 답할 수 있다면 신청서 작성으로 진행하세요.
      </p>
      <Link
        href={hrefWithType}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:brightness-95 dark:bg-red-900/30 dark:text-red-300"
      >
        신청서 작성으로
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
