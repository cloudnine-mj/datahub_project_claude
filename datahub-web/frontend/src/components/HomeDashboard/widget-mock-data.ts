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

export const MOCK_TODOS: TodoItem[] = [
  {
    id: "t1",
    type: "service",
    title: "중간 산출물 검수 필요",
    modifiedAt: "5/13",
    requestId: "req-001",
  },
  {
    id: "t2",
    type: "purchase",
    title: "활용범위 합의 응답 대기",
    modifiedAt: "5/14",
    requestId: "req-002",
  },
];

export const MOCK_IN_PROGRESS: InProgressItem[] = [
  {
    id: "p1",
    type: "purchase",
    title: "음성 인식 학습 데이터",
    phase: 2,
    phaseLabel: "구축",
    progressPercent: 66,
    requestId: "req-101",
  },
  {
    id: "p2",
    type: "service",
    title: "의료 영상 어노테이션",
    phase: 3,
    phaseLabel: "적재",
    progressPercent: 90,
    requestId: "req-102",
  },
  {
    id: "p3",
    type: "subscribe",
    title: "뉴스 기사 스트림",
    phase: 1,
    phaseLabel: "기획",
    progressPercent: 33,
    requestId: "req-103",
  },
];

export const MOCK_DATASETS: DatasetItem[] = [
  { id: "d1", name: "한국어 음성 코퍼스 v2", loadedAt: "2026-04" },
  { id: "d2", name: "뉴스 분류 학습셋", loadedAt: "2026-03" },
];

export const MOCK_ANNOUNCEMENTS: AnnouncementItem[] = [
  { id: "a1", title: "용역 제작 가이드 v2.1 배포", date: "5/10" },
  { id: "a2", title: "2분기 정책 변경 안내", date: "5/2" },
];
