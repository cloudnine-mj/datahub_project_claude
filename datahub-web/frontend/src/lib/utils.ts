import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

export const FORM_TYPE_LABELS: Record<string, string> = {
  data_production: "데이터 용역 제작 신청서",
  data_purchase: "데이터 구매 신청서",
  data_subscription: "데이터 구독 신청서",
  product_log_usage: "Product 로그 데이터 활용 신청서",
  data_production_plan: "데이터 제작 계획서",
  api_usage_plan: "API 활용 계획서",
  productivity_tool: "업무생산성 도구 신청서",
};

export const BOARD_LABELS: Record<string, string> = {
  policy: "데이터 관리 정책",
  process: "데이터 제작 / 활용 요청 프로세스",
};

/** 통합된 process 보드의 카테고리 옵션 (제작 / 활용 요청). */
export const PROCESS_CATEGORIES = ["제작 프로세스", "활용 요청 프로세스"] as const;
export type ProcessCategory = (typeof PROCESS_CATEGORIES)[number];

/** 게시글 문서 유형 — 카테고리와 독립된 작은 분류 축. */
export const DOC_TYPES = ["가이드", "공지"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** 문서 유형별 뱃지 색 — Severity 와 같은 룩. */
export const DOC_TYPE_STYLES: Record<string, { pill: string; dot: string }> = {
  가이드: { pill: "bg-gray-50 text-gray-700 border-gray-200", dot: "bg-gray-400" },
  공지: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};
