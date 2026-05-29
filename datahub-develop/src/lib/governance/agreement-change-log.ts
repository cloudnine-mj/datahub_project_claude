// 최종 협의 내용 변경 이력(changeLog) 헬퍼.
//
// 변경 이력은 별도 sessionStorage 키로 분리하지 않고 dh:gov:negotiation:{formId} 객체 안
// changeLog 필드에 통합 보관(negotiation-storage 소유). 본 파일은 그 위의 조작 헬퍼만 제공.
//
//   - initSystemEntry: 계약 단계 진입 시 시스템 항목 1건 생성(이미 있으면 무시).
//   - pushChange: 셀 편집으로 값이 실제 바뀐 경우만 1건 추가(before === after 면 무시).
//   - getLog / nonSystemCount / latestFor: 표시용 조회 헬퍼.

import {
  NEGOTIATION_FIELDS,
  persistNegotiation,
  readNegotiation,
  type ChangeLogEntry,
  type NegotiationField,
  type NegotiationResult,
} from "./negotiation-storage";

export type { ChangeLogEntry } from "./negotiation-storage";

/** 필드 키 → 한국어 라벨. */
export const FIELD_LABELS: Record<NegotiationField, string> = {
  selectedVendor: "선정 업체",
  amount: "금액",
  period: "작업 기간",
  workCount: "작업 건수",
};

function filledCount(n: NegotiationResult): number {
  return NEGOTIATION_FIELDS.filter((k) => n[k].trim().length > 0).length;
}

/** 계약 단계 진입 시 시스템 항목 1건 자동 생성. changeLog 가 이미 있으면 그대로 둔다. */
export function initSystemEntry(formId: string, actor: string): NegotiationResult {
  const current = readNegotiation(formId);
  if (current.changeLog.length > 0) return current;
  const n = filledCount(current);
  const entry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    actor,
    field: "system",
    fieldLabel: "시스템",
    before: null,
    after: null,
    note: `협의 단계에서 [계약 단계로 진행] · 최종 협의 내용 ${n}건 최초 기록`,
  };
  const next: NegotiationResult = { ...current, changeLog: [entry] };
  persistNegotiation(formId, next);
  return next;
}

/** 값이 실제로 바뀐 경우(before !== after)만 changeLog 에 1건 추가. */
export function pushChange(
  formId: string,
  field: NegotiationField,
  before: string,
  after: string,
  actor: string,
): NegotiationResult {
  const current = readNegotiation(formId);
  if (before === after) return current;
  const entry: ChangeLogEntry = {
    timestamp: new Date().toISOString(),
    actor,
    field,
    fieldLabel: FIELD_LABELS[field],
    before: before.length > 0 ? before : null,
    after: after.length > 0 ? after : null,
  };
  const next: NegotiationResult = {
    ...current,
    changeLog: [...current.changeLog, entry],
  };
  persistNegotiation(formId, next);
  return next;
}

/** 시스템 항목을 제외한 실제 수정 건수 — "계약 단계 N건 수정" 뱃지용. */
export function nonSystemCount(log: ChangeLogEntry[]): number {
  return log.filter((e) => e.field !== "system").length;
}

/** 특정 필드의 가장 최근 변경 항목 — 행의 "마지막 변경 시각·작성자" 표시용. */
export function latestFor(
  log: ChangeLogEntry[],
  field: NegotiationField,
): ChangeLogEntry | null {
  let found: ChangeLogEntry | null = null;
  log.forEach((e) => {
    if (e.field === field) found = e;
  });
  return found;
}

/** 표시용 정렬 — 최신 위, 시스템(최초 진입) 항목은 항상 맨 아래 보존. */
export function sortedForDisplay(log: ChangeLogEntry[]): ChangeLogEntry[] {
  const system = log.filter((e) => e.field === "system");
  const edits = log
    .filter((e) => e.field !== "system")
    .slice()
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return [...edits, ...system];
}
