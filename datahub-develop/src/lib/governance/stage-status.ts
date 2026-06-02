// 협의·계약 단계 완료 상태 sessionStorage CRUD 헬퍼.
//
// Phase 1: 백엔드 컬럼이 없으므로 단계별 완료 여부를 sessionStorage 에 영속.
//   - dh:gov:negotiation:{formId}:status — 협의 완료 여부 + 시각
//   - dh:gov:contract:{formId}:status    — 계약 완료 여부 + 시각
// Phase 2: Negotiation/Contract 테이블에 isCompleted, completedAt 컬럼 추가 + API 로 교체.
//   본 파일의 read/markComplete 시그니처는 유지.

export interface StageStatus {
  isCompleted: boolean;
  completedAt: string | null;
}

function key(scope: "negotiation" | "contract", formId: string): string {
  return `dh:gov:${scope}:${formId}:status`;
}

function emptyStatus(): StageStatus {
  return { isCompleted: false, completedAt: null };
}

function readKey(k: string): StageStatus {
  if (typeof window === "undefined") return emptyStatus();
  try {
    const raw = sessionStorage.getItem(k);
    if (!raw) return emptyStatus();
    const parsed = JSON.parse(raw) as Partial<StageStatus>;
    return {
      isCompleted: Boolean(parsed.isCompleted),
      completedAt: parsed.completedAt ? String(parsed.completedAt) : null,
    };
  } catch {
    return emptyStatus();
  }
}

function writeKey(k: string, v: StageStatus): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function readNegotiationStatus(formId: string): StageStatus {
  return readKey(key("negotiation", formId));
}

export function readContractStatus(formId: string): StageStatus {
  return readKey(key("contract", formId));
}

/** 완료 처리 후, 같은 화면의 진행 이력 카드가 즉시 갱신되도록 알린다(자료 카드와 동일 패턴). */
function dispatchChanged(formId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("dh:gov:stage-status-changed", { detail: { formId } }),
  );
}

export function markNegotiationComplete(formId: string): StageStatus {
  const v: StageStatus = { isCompleted: true, completedAt: new Date().toISOString() };
  writeKey(key("negotiation", formId), v);
  dispatchChanged(formId);
  return v;
}

export function markContractComplete(formId: string): StageStatus {
  const v: StageStatus = { isCompleted: true, completedAt: new Date().toISOString() };
  writeKey(key("contract", formId), v);
  dispatchChanged(formId);
  return v;
}
