// 서비스 4단계 완료일 관리 — 진행 이력(큰 4단계) 카드의 완료 날짜 표시용.
//   dh:gov:stage-state:{formId} → { completedAt: { <stageKey>: 'YYYY-MM-DD' } }
// Phase 1: 진행 단계 진입 시점에 이전 단계 완료일을 lazily 백필(mock). Phase 2: 실제 전환 시각 기록.

import { todayYmd } from "./feedback-storage";

export type ServiceStageKey =
  | "request_review"
  | "negotiation_contract"
  | "progress"
  | "closure";

export const SERVICE_STAGE_KEYS: readonly ServiceStageKey[] = [
  "request_review",
  "negotiation_contract",
  "progress",
  "closure",
];

export interface StageState {
  completedAt: Partial<Record<ServiceStageKey, string>>;
}

const STATE_KEY = (formId: string) => `dh:gov:stage-state:${formId}`;

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

export function readStageState(formId: string): StageState {
  const v = readJson<Partial<StageState>>(STATE_KEY(formId), {});
  return { completedAt: v.completedAt ?? {} };
}

export function markStageCompleted(
  formId: string,
  key: ServiceStageKey,
  dateYmd?: string,
): StageState {
  const cur = readStageState(formId);
  if (cur.completedAt[key]) return cur; // 이미 기록된 건 보존.
  const next: StageState = {
    completedAt: { ...cur.completedAt, [key]: dateYmd ?? todayYmd() },
  };
  writeJson(STATE_KEY(formId), next);
  return next;
}

/** 현재 단계 인덱스(0~3) 이전의 모든 단계 완료일을 없으면 오늘로 백필. */
export function ensureCompletedUpTo(formId: string, currentIndex: number): StageState {
  let state = readStageState(formId);
  for (let i = 0; i < currentIndex; i += 1) {
    const key = SERVICE_STAGE_KEYS[i];
    if (key && !state.completedAt[key]) {
      state = markStageCompleted(formId, key);
    }
  }
  return state;
}
