// API 활용 계획서 — 2단계 (기획 / 운영) 프로세스 구성 + 진행 상태 헬퍼.
//   각 phase 는 3 substep 으로 구성. 1단계: 계획 수립 / 신청서 작성 / 전자결재 품의.
//   2단계: API 활용 / 비용 처리 / 결과물 적재.
//
//   기존 데이터 용역/구매/구독(3단계 ProcessStepper) 과 달리, API 플로우는
//   양쪽 단계의 substep 을 모두 동시에 노출 (미래 단계는 disabled + opacity).

export type ApiPhaseId = "plan" | "operate";

export type ApiSubstepId =
  | "planning"
  | "form"
  | "approval"
  | "api-operate"
  | "cost"
  | "store";

export type StepStatus = "completed" | "current" | "pending";

export interface ApiSubstepDef {
  id: ApiSubstepId;
  label: string;
  path: string;
}

export interface ApiPhaseDef {
  id: ApiPhaseId;
  /** Phase pill 에 노출 (예: '1. 기획'). */
  label: string;
  /** Substep 그룹 상단 라벨 (예: '1단계 · 기획'). */
  groupLabel: string;
  substeps: ApiSubstepDef[];
}

const BASE = "/governance/api-applications";

export const API_PROCESS: ApiPhaseDef[] = [
  {
    id: "plan",
    label: "1. 기획",
    groupLabel: "1단계 · 기획",
    substeps: [
      { id: "planning", label: "계획 수립", path: `${BASE}/planning` },
      { id: "form", label: "신청서 작성", path: `${BASE}/form` },
      { id: "approval", label: "전자결재 품의", path: `${BASE}/approval` },
    ],
  },
  {
    id: "operate",
    label: "2. 운영",
    groupLabel: "2단계 · 운영",
    substeps: [
      { id: "api-operate", label: "API 활용", path: `${BASE}/operate` },
      { id: "cost", label: "비용 처리", path: `${BASE}/cost` },
      { id: "store", label: "결과물 적재", path: `${BASE}/store` },
    ],
  },
];

/** Substep id 가 어느 phase 에 속하는지 찾기. */
export function phaseOf(substepId: ApiSubstepId): ApiPhaseDef {
  const phase = API_PROCESS.find((p) => p.substeps.some((s) => s.id === substepId));
  if (!phase) {
    throw new Error(`Unknown API substep id: ${substepId}`);
  }
  return phase;
}

/** 현재 substep 기준으로 각 substep 의 status 산정.
 *  - 현재 substep 이전 (linear 순회) → completed
 *  - 현재 substep → current
 *  - 이후 → pending
 */
export function buildSubstepStatuses(
  currentId: ApiSubstepId,
): Record<ApiSubstepId, StepStatus> {
  const flat = API_PROCESS.flatMap((p) => p.substeps);
  const idx = flat.findIndex((s) => s.id === currentId);
  const map = {} as Record<ApiSubstepId, StepStatus>;
  flat.forEach((s, i) => {
    map[s.id] = i < idx ? "completed" : i === idx ? "current" : "pending";
  });
  return map;
}

/** 미래 phase 여부 — 현재 phase 가 plan 일 때 operate 가 future. */
export function isFuturePhase(phase: ApiPhaseId, currentPhase: ApiPhaseId): boolean {
  return currentPhase === "plan" && phase === "operate";
}
