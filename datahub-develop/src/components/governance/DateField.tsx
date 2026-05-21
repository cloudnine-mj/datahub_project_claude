// 날짜 입력 공용 컴포넌트 — 네이티브 `<input type="date">` 단일 사용.
// 좌측 달력 picker icon 은 globals.css 의 ::-webkit-calendar-picker-indicator
// 규칙으로 자동 정렬. 빈 상태일 때 '연도. 월. 일.' 텍스트가 회색으로 보이도록
// required 속성을 항상 부여 — globals.css 의 :invalid 셀렉터가 잡힘.

"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
  /** 표시 안 됨 (네이티브 placeholder 없음). 호환을 위해 prop 만 유지. */
  placeholder?: string;
  /** 실제 폼 validation 은 schema 단에서 처리. 이 prop 은 placeholder 회색
   *  스타일 적용 위해 빈 상태에서도 :invalid 가 잡히게 하는 용도. 기본 true. */
  required?: boolean;
}

export function DateField({ value, onChange, disabled, id, required = true }: Props) {
  return (
    <input
      id={id}
      type="date"
      value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className="w-full rounded-md border border-gray-200 bg-white py-2 pr-3 text-[13px] focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800/60"
    />
  );
}
