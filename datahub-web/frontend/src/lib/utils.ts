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
};

export const BOARD_LABELS: Record<string, string> = {
  policy: "데이터 관리 정책",
  production_process: "데이터 제작 프로세스",
  usage_process: "데이터 활용 요청 프로세스",
};
