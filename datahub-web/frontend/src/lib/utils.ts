import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 백엔드는 datetime.utcnow() 로 naive UTC 를 저장하고 ISO 문자열로 직렬화하는데
 * tz 정보가 없는 ISO 문자열은 브라우저가 '로컬 시각' 으로 해석해 9시간(KST) 어긋남.
 * 이 헬퍼는 tz 표시(Z 또는 ±HH:MM) 가 없으면 UTC 로 간주해 'Z' 를 붙여 파싱한다.
 *
 * 결과 Date 객체에 대한 toLocaleString / getHours 등은 자동으로 KST(브라우저 로컬) 로 표시됨.
 */
export function parseUtc(iso: string): Date {
  if (!iso) return new Date(NaN);
  // 이미 tz 정보가 있으면 그대로 파싱
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) return new Date(iso);
  // 시각이 포함된 ISO 라면 UTC 로 간주
  if (/T\d{2}:\d{2}/.test(iso)) return new Date(iso + "Z");
  // 'YYYY-MM-DD' 같은 날짜만 있는 경우는 그대로 (날짜 단위라 tz 의미가 옅음)
  return new Date(iso);
}

export function formatDate(iso: string): string {
  const d = parseUtc(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

/** 날짜+시각 — YYYY.MM.DD HH:MM (브라우저 로컬 = KST). */
export function formatDateTime(iso: string): string {
  const d = parseUtc(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
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

/** 통합된 process 보드의 카테고리 옵션 (제작 / 요청). */
export const PROCESS_CATEGORIES = ["제작 프로세스", "요청 프로세스"] as const;
export type ProcessCategory = (typeof PROCESS_CATEGORIES)[number];

/** 게시글 문서 유형 — 카테고리와 독립된 작은 분류 축. */
export const DOC_TYPES = ["가이드", "공지"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/** 문서 유형별 뱃지 색 — Severity 와 같은 룩. */
export const DOC_TYPE_STYLES: Record<string, { pill: string; dot: string }> = {
  가이드: { pill: "bg-gray-50 text-gray-700 border-gray-200", dot: "bg-gray-400" },
  공지: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};
