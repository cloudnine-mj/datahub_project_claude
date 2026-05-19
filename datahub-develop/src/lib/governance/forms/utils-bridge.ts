/**
 * datahub-web `lib/utils.ts` 를 그대로 옮긴 bridge — governance 컴포넌트 호환 유지.
 * datahub-develop 자체 `lib/utils.ts` (cn 함수만 있음) 와 분리.
 */
import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 이름에서 아바타용 이니셜 — 영문 두 단어면 각 첫 글자, 그 외엔 앞 1~2자. */
export function approverInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * 백엔드 datetime 이 tz 없는 ISO 문자열일 때 UTC 로 간주해 'Z' 를 붙여 파싱.
 * 결과 Date 객체에 대한 toLocaleString / getHours 는 자동으로 브라우저 로컬(KST) 로 표시됨.
 */
export function parseUtc(iso: string): Date {
  if (!iso) return new Date(NaN);
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) return new Date(iso);
  if (/T\d{2}:\d{2}/.test(iso)) return new Date(iso + "Z");
  return new Date(iso);
}

export function formatDate(iso: string): string {
  const d = parseUtc(iso);
  if (Number.isNaN(d.getTime())) return iso || "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

/** 날짜+시각 — YYYY.MM.DD HH:MM (브라우저 로컬 = KST). */
export function formatDateTime(iso: string): string {
  const d = parseUtc(iso);
  if (Number.isNaN(d.getTime())) return iso || "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

export const FORM_TYPE_LABELS: Record<string, string> = {
  data_production: "데이터 용역 제작 신청",
  data_purchase: "데이터 구매 신청",
  data_subscription: "데이터 구독 신청",
  product_log_usage: "Product 로그 데이터 활용 신청",
  data_production_plan: "데이터 제작 계획서",
  api_usage_plan: "API 활용 계획서",
  productivity_tool: "업무생산성 도구 신청",
};

export const BOARD_LABELS: Record<string, string> = {
  policy: "데이터 거버넌스 정책",
  process: "데이터 제작 / 활용 요청 프로세스",
};

/** 통합된 process 보드의 카테고리 옵션 (제작 / 요청). */
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
