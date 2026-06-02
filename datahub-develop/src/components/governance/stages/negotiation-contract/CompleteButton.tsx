// 협의·계약 완료 버튼 공용 — 카드 내부 우하단에 배치. #1D9E75 채움 + CircleCheck 아이콘.
//   비활성: opacity 0.5 + secondary 배경, helperText 로 활성 조건 안내.

"use client";

import { CircleCheck } from "lucide-react";

interface Props {
  label: string;
  isEnabled: boolean;
  helperText?: string;
  onClick: () => void;
}

export function CompleteButton({ label, isEnabled, helperText, onClick }: Props) {
  return (
    <div className="mt-3 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={!isEnabled}
        className={
          isEnabled
            ? "inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-3.5 py-2 text-[11px] font-medium text-white transition hover:brightness-110"
            : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-[var(--color-background-secondary,#f3f4f6)] px-3.5 py-2 text-[11px] font-medium text-[var(--color-text-tertiary,#9ca3af)] opacity-50 dark:bg-gray-800"
        }
      >
        <CircleCheck size={13} aria-hidden="true" /> {label}
      </button>
      {helperText && (
        <span className="text-[10px] text-[var(--color-text-tertiary,#9ca3af)]">
          {helperText}
        </span>
      )}
    </div>
  );
}
