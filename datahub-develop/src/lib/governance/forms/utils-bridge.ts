/**
 * datahub-web `lib/utils.ts` 의 함수들을 거버넌스 컴포넌트에서 쓰기 위한 bridge.
 * datahub-develop 자체 `lib/utils.ts` (cn 함수만 있음) 와 분리.
 */
export { cn } from "@/lib/utils";

/** 이름 → 이니셜 (한글 2글자 / 영문 첫 2글자). */
export function approverInitials(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2);
}

/** ISO/Date 문자열 → "YYYY-MM-DD HH:mm" 표시용. */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "-";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return String(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mi}`;
}

export const FORM_TYPE_LABELS: Record<string, string> = {
  data_production: "데이터 용역 제작 신청",
  data_purchase: "데이터 구매 신청",
  data_subscription: "데이터 구독 신청",
  product_log_usage: "Product 로그 활용 신청",
  data_production_plan: "데이터 제작 계획서",
  api_usage_plan: "API 활용 계획서",
  productivity_tool: "업무 생산성 도구 신청",
};

export const PROCESS_CATEGORIES = ["제작 프로세스", "활용 요청 프로세스"] as const;

export const BOARD_LABELS: Record<string, string> = {
  policy: "데이터 관리 정책",
  process: "데이터 제작 / 활용 요청 프로세스",
};
