// 날짜 입력 공용 컴포넌트 — 텍스트 입력 + 좌측 달력 아이콘 버튼.
//   기본 `<input type="date">` 의 우측 picker 아이콘 + 한국어 placeholder ("연도. 월. 일.") 우회.
//   - 비어있을 때 'YYYY-MM-DD' 형식 안내
//   - 자유 타이핑 가능 (수동 수정), 달력 아이콘 클릭 시 네이티브 picker (showPicker API)
//   FormBuilder / ApplicationFormSection 양쪽에서 공용 사용.

"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** picker 가 못 열릴 때를 대비한 input 의 aria-label/id 매칭용. */
  id?: string;
  placeholder?: string;
}

export function DateField({
  value,
  onChange,
  disabled,
  id,
  placeholder = "YYYY-MM-DD",
}: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // 일부 브라우저는 보안상 throw — fallback
      }
    }
    el.click();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="달력 열기"
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <Calendar size={14} aria-hidden="true" />
      </button>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-[13px] focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800/60"
      />
      {/* 시각적으로 숨긴 네이티브 date — picker 위치를 좌측 아이콘 옆으로 고정. */}
      <input
        ref={dateInputRef}
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="pointer-events-none absolute left-2 top-1/2 h-0 w-0 -translate-y-1/2 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
