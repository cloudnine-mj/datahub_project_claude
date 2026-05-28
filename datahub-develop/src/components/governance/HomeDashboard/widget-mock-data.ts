// 나의 현황 대시보드 위젯용 임시 데이터.
//   실 API 연동 전까지 시각/구조 검증 목적.

export type RequestType =
  | "service"
  | "purchase"
  | "subscribe"
  | "product-log"
  | "api"
  | "productivity";

export type Phase = 1 | 2 | 3;

export interface TodoItem {
  id: string;
  type: RequestType;
  title: string;
  /** "5/14" 같은 short form. */
  modifiedAt: string;
  requestId: string;
}

export interface InProgressItem {
  id: string;
  type: RequestType;
  title: string;
  phase: Phase;
  phaseLabel: "기획" | "구축" | "적재";
  modifiedAt: string;
  requestId: string;
}

export interface UpcomingEvent {
  id: string;
  /** "5/19 (월)" 같은 표시용 문자열. */
  date: string;
  /** 0/1/2... 잔여 일수. 색상 분기에 사용. */
  dDay: number;
  title: string;
}

export interface DatasetItem {
  id: string;
  name: string;
  /** "2026-04-22" 같은 YYYY-MM-DD. */
  loadedAt: string;
}

export interface NoticeItem {
  id: string;
  title: string;
  publishedAt: string;
  isImportant: boolean;
}

export const MOCK_TODOS: TodoItem[] = [
  {
    id: "t1",
    type: "service",
    title: "검수 피드백 작성 필요 — 의료 코퍼스 2차",
    modifiedAt: "5/14",
    requestId: "REQ-2026-031",
  },
  {
    id: "t2",
    type: "subscribe",
    title: "담당자 논의 일정 확정 — 뉴스 피드",
    modifiedAt: "5/13",
    requestId: "REQ-2026-029",
  },
];

export const MOCK_IN_PROGRESS: InProgressItem[] = [
  {
    id: "p1",
    type: "service",
    title: "의료 음성 코퍼스 20,000건",
    phase: 2,
    phaseLabel: "구축",
    modifiedAt: "5/14",
    requestId: "REQ-2026-031",
  },
  {
    id: "p2",
    type: "purchase",
    title: "한국어 음성 코퍼스 v3 라이선스",
    phase: 1,
    phaseLabel: "기획",
    modifiedAt: "5/13",
    requestId: "REQ-2026-030",
  },
  {
    id: "p3",
    type: "subscribe",
    title: "뉴스 코퍼스 월간 피드",
    phase: 1,
    phaseLabel: "기획",
    modifiedAt: "5/12",
    requestId: "REQ-2026-028",
  },
];

export const MOCK_UPCOMING_EVENTS: UpcomingEvent[] = [
  { id: "e1", date: "5/19 (월)", dDay: 1, title: "의료 코퍼스 2차 검수 마감" },
  { id: "e2", date: "5/20 (화)", dDay: 2, title: "담당자 논의 — 김은솔" },
  { id: "e3", date: "5/22 (목)", dDay: 4, title: "뉴스 피드 1차 납품 예정" },
  { id: "e4", date: "5/26 (월)", dDay: 8, title: "한국어 코퍼스 결재 마감" },
];

export const MOCK_DATASETS: DatasetItem[] = [
  { id: "d1", name: "한국어 음성 코퍼스 v2", loadedAt: "2026-04-22" },
  { id: "d2", name: "의료 영상 어노테이션 셋", loadedAt: "2026-03-15" },
  { id: "d3", name: "뉴스 분류 학습 데이터", loadedAt: "2026-02-08" },
];

export const MOCK_NOTICES: NoticeItem[] = [
  {
    id: "n1",
    title: "거버넌스 정책 v2 개정 안내",
    publishedAt: "2026-05-15",
    isImportant: true,
  },
  {
    id: "n2",
    title: "신청서 양식 업데이트 (5월부터 적용)",
    publishedAt: "2026-05-10",
    isImportant: false,
  },
];
