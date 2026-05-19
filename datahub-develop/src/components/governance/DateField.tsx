// 날짜 입력 공용 컴포넌트 — 네이티브 `<input type="date">` 단일 사용.
// 좌측 달력 picker icon 은 globals.css 의 ::-webkit-calendar-picker-indicator
// 규칙으로 자동 정렬됨. 별도 placeholder/숨김 트릭 불필요.

"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
  /** 표시 안 됨 (네이티브 placeholder 없음). 호환을 위해 prop 만 유지. */
  placeholder?: string;
}

export function DateField({ value, onChange, disabled, id }: Props) {
  return (
    <input
      id={id}
      type="date"
      value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-md border border-gray-200 bg-white py-2 pr-3 text-[13px] focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800/60"
    />
  );
}
