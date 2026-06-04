// 최종 데이터 검토 결정 카드 — 진행 단계 페이지 하단(기존 [종료 단계로] 자리 대체).
//   [수정 필요] → 피드백 작성 모달(납품 구분 '수정' 자동 선택) / [종료] → 양식 모달(별도 작업).
//   항상 노출(조건부 노출 없음).

"use client";

import { Check, ClipboardCheck, Edit } from "lucide-react";

interface Props {
  /** [수정 필요] — 피드백 작성 모달을 '수정' 자동 선택으로 연다. */
  onRevision: () => void;
  /** [종료] — 양식 모달 흐름(별도 작업). Phase 1: alert. */
  onFinish: () => void;
}

export function FinalReviewDecisionCard({ onRevision, onFinish }: Props) {
  return (
    <section
      style={{
        background: "#FCF3F0",
        border: "0.5px solid #EFC4B9",
        borderRadius: 11,
        padding: "16px 18px",
      }}
    >
      <header className="mb-1.5 flex items-center gap-1.5">
        <ClipboardCheck size={16} aria-hidden="true" className="text-[#D4533E]" />
        <h3 className="text-[13px] font-medium text-[#993C1D]">최종 데이터 검토</h3>
      </header>
      <p className="mb-3 text-[11px] text-[#993C1D]" style={{ lineHeight: 1.7 }}>
        최종 데이터를 받으셨다면 검토 후 진행해 주세요. 문제가 없다면 종료로, 데이터 수정이 필요하다면 피드백 단계로 돌아갈 수 있습니다.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRevision}
          className="flex items-center justify-center gap-1.5 bg-white transition hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
          style={{
            border: "0.5px solid var(--color-border-secondary,#d1d5db)",
            borderRadius: 7,
            padding: 11,
          }}
        >
          <Edit size={13} aria-hidden="true" className="text-[var(--color-text-secondary,#6b7280)]" />
          <span className="text-[11px] text-[var(--color-text-primary,#111827)] dark:text-gray-100">
            수정 필요
          </span>
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="flex items-center justify-center gap-1.5 text-white transition hover:brightness-110"
          style={{ background: "#D4533E", borderRadius: 7, padding: 11 }}
        >
          <Check size={13} aria-hidden="true" />
          <span className="text-[11px]">종료</span>
        </button>
      </div>
    </section>
  );
}
