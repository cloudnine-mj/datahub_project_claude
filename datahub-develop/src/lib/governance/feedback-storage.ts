// 진행 단계(3/4) 피드백 이력 sessionStorage CRUD 헬퍼.
//
// v3 최종: 데이터는 Datahub에 적재하지 않음(메일·SharePoint). 진행 단계는 신청자의
//   피드백 누적·관리에만 집중. 모든 피드백은 납품 구분(중간/수정/최종) 필수 + 사용자가
//   직접 입력한 데이터 수령일(receivedDate)을 가진다.
//   - dh:gov:feedback-history:{formId}  — 피드백 이력
// Phase 2: FeedbackHistory 테이블 + API 로 교체. read/append 시그니처 유지.

export type DeliveryRound = "middle" | "modified" | "final";

export interface FeedbackAttachmentMeta {
  name: string;
  size: number;
  type: string;
}

export interface FeedbackItem {
  id: string;
  deliveryRound: DeliveryRound; // 필수
  roundNumber: number; // 같은 납품 구분 내 자동 회차(1차, 2차…)
  receivedDate: string; // YYYY-MM-DD, 사용자 입력 (메일·SharePoint 수령일)
  content: string; // 필수
  attachments: FeedbackAttachmentMeta[]; // 선택, 빈 배열 가능
  author: string;
  createdAt: string; // ISO, 시스템 자동(전송 시점)
}

const FEEDBACK_KEY = (formId: string) => `dh:gov:feedback-history:${formId}`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function dispatchChanged(formId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("dh:gov:feedback-changed", { detail: { formId } }),
  );
}

// ── 피드백 이력 ──────────────────────────────────────────────────────────────

export function readFeedbackHistory(formId: string): FeedbackItem[] {
  const list = readJson<FeedbackItem[]>(FEEDBACK_KEY(formId), []);
  // 마이그레이션 — roundNumber 가 없거나 0/누락인 기존 데이터를 자동 재계산.
  //   (roundNumber 필드 도입 전에 저장된 피드백이 "· 차"로 표시되는 버그 방지.)
  let needsMigration = false;
  list.forEach((f) => {
    if (!f.roundNumber || f.roundNumber < 1) needsMigration = true;
  });
  if (!needsMigration) return list;
  const migrated = migrateRoundNumbers(list);
  writeJson(FEEDBACK_KEY(formId), migrated);
  return migrated;
}

/** 작성 시각 오름차순으로 납품 구분별 회차(1,2,3…)를 재부여. */
function migrateRoundNumbers(history: FeedbackItem[]): FeedbackItem[] {
  const counters: Record<DeliveryRound, number> = { middle: 0, modified: 0, final: 0 };
  const sorted = history.slice().sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return ta - tb;
  });
  sorted.forEach((f) => {
    counters[f.deliveryRound] += 1;
    f.roundNumber = counters[f.deliveryRound];
  });
  return sorted;
}

/** 같은 납품 구분의 다음 회차 = 기존 건수 + 1. */
export function calculateRoundNumber(
  history: FeedbackItem[],
  deliveryRound: DeliveryRound,
): number {
  let count = 0;
  history.forEach((f) => {
    if (f.deliveryRound === deliveryRound) count += 1;
  });
  return count + 1;
}

export function appendFeedback(
  formId: string,
  next: Omit<FeedbackItem, "id" | "createdAt" | "roundNumber">,
): FeedbackItem {
  const current = readFeedbackHistory(formId);
  const item: FeedbackItem = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deliveryRound: next.deliveryRound,
    roundNumber: calculateRoundNumber(current, next.deliveryRound),
    receivedDate: next.receivedDate,
    content: next.content,
    attachments: next.attachments,
    author: next.author,
    createdAt: new Date().toISOString(),
  };
  writeJson(FEEDBACK_KEY(formId), [...current, item]);
  dispatchChanged(formId);
  return item;
}

// ── 라벨/색상 매핑 (UI 공용) ─────────────────────────────────────────────────

export function deliveryLabel(round: DeliveryRound): string {
  return round === "middle" ? "중간 납품" : round === "modified" ? "수정 납품" : "최종 납품";
}

export function deliveryShortLabel(round: DeliveryRound): string {
  return round === "middle" ? "중간" : round === "modified" ? "수정" : "최종";
}

export function deliveryColors(round: DeliveryRound): { bg: string; text: string } {
  if (round === "middle") return { bg: "#E6F1FB", text: "#0C447C" };
  if (round === "modified") return { bg: "#FAEEDA", text: "#854F0B" };
  return { bg: "#FCF3F0", text: "#D4533E" };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** YYYY-MM-DD HH:mm */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/** 오늘 날짜 YYYY-MM-DD (date input 기본값). */
export function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
