// 나의 현황 대시보드 위젯용 임시 데이터.
//   실제 API 연동 전까지 시각/구조 검증 목적. 백엔드 연결 시 fetch 로 교체.

export type RequestType =
  | "service"
  | "purchase"
  | "subscribe"
  | "product-log"
  | "api"
  | "productivity";

export interface TodoItem {
  id: string;
  type: RequestType;
  title: string;
  /** 표시용 날짜 문자열 — "5/13" 같은 short form. */
  modifiedAt: string;
  requestId: string;
}

export interface InProgressItem {
  id: string;
  type: RequestType;
  title: string;
  phase: 1 | 2 | 3;
  phaseLabel: "기획" | "구축" | "적재";
  /** 0-100. 단계별 권장 값: 기획 33 / 구축 66 / 적재 90 / 완료 100. */
  progressPercent: number;
  requestId: string;
}

export interface DatasetItem {
  id: string;
  name: string;
  /** "2026-04" 같은 적재 월 표시. */
  loadedAt: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  /** "5/10" 같은 short form. */
  date: string;
}

// 실데이터 연동 전까지 모든 위젯 empty state 노출.
export const MOCK_TODOS: TodoItem[] = [];
export const MOCK_IN_PROGRESS: InProgressItem[] = [];
export const MOCK_DATASETS: DatasetItem[] = [];
export const MOCK_ANNOUNCEMENTS: AnnouncementItem[] = [];
