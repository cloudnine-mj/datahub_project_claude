/**
 * 천 단위 쉼표가 적용된 숫자 입력 — `<input type="number">` 대체.
 *
 * 표시는 "3,000" 형태, 내부 값은 숫자 그대로. 입력 시 숫자 외 문자는 자동 제거.
 * inputMode="numeric" 으로 모바일 키패드는 숫자만 표시.
 */
"use client";

import { forwardRef } from "react";

interface Props
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | string;
  /** parsed Number (입력이 비어있으면 0). 원본 raw string 도 두 번째 인자로 전달. */
  onChange: (value: number, raw: string) => void;
}

function formatWithComma(v: number | string): string {
  if (v === "" || v === null || v === undefined) return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d-]/g, ""));
  if (!Number.isFinite(n) || n === 0) {
    // 0 이지만 사용자가 "0" 을 입력 중일 수 있으니, 명시적 number 0 만 빈 칸으로.
    if (typeof v === "number" && v === 0) return "";
    return String(v).replace(/[^\d]/g, "");
  }
  return n.toLocaleString("ko-KR");
}

export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onChange, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatWithComma(value)}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        const n = raw === "" ? 0 : Number(raw);
        onChange(n, raw);
      }}
      className={className}
      {...rest}
    />
  );
});
