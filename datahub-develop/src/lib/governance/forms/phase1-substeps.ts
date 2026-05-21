// 1단계(기획) substep + phase 정의 — 신청 유형(service / purchase / subscribe) 별로
//   동일하게 단순화: 1 phase (1.기획) + substep 2 개 (계획 수립 / 신청서 작성).
//
// 사내 정책 변경으로 신청자 화면은 계획·작성까지만 노출. 전자결재·결재 확인·담당자
// 논의·계약 체결 substep + 2.구축 / 3.적재 phase 는 모두 제거.
//
// path 값은 모두 기존과 동일 — UI/UX 와 라우트는 그대로 유지하고 데이터 정의만 변경.

import type { PlanningType } from "./planning-config";

/** 진행 단계 / 서브스텝 상태. ProcessStepper 컴포넌트와 공유. */
export type StepStatus = "done" | "current" | "pending";

export interface Phase {
  id: string;
  label: string;
  status: StepStatus;
  /** 클릭 시 이동할 경로 — done 이면서 path 가 있을 때만 Link 로 렌더. */
  path?: string;
}

export interface SubStep {
  id: string;
  label: string;
  status: StepStatus;
  path?: string;
}

export type Phase1SubstepId =
  | "planning"
  | "form"
  // 아래 substep id 들은 더 이상 노출되지 않지만, 기존 페이지의 URL 직접 진입 시
  // type-check 위해 유니온은 유지. 새 흐름엔 사용되지 않음.
  | "approval"
  | "approval-check"
  | "discussion"
  | "contract";

interface SubstepDef {
  id: Phase1SubstepId;
  label: string;
  path: string;
}

// 모든 신청 유형에 동일 적용 — 계획 수립 → 신청서 작성 2단계.
const SUBSTEP_DEFS_COMMON: SubstepDef[] = [
  { id: "planning", label: "계획 수립", path: "/governance/forms/planning" },
  { id: "form", label: "신청서 작성", path: "/governance/forms/intake" },
];

function defsFor(_type: PlanningType | undefined): SubstepDef[] {
  return SUBSTEP_DEFS_COMMON;
}

/** 유형별 phase pill 배열 — 세 유형 모두 1.기획 단일 phase.
 *  ProcessStepper 가 phases.length<=1 일 때 상단 행 자체를 숨기므로 시각적으로도 깔끔. */
export function getPhase1Phases(_type?: PlanningType): Phase[] {
  return [{ id: "plan", label: "1. 기획", status: "current" }];
}

/** 호환용 — 기본 phase. 새 코드는 getPhase1Phases(type) 사용 권장. */
export const PHASE1_PHASES: Phase[] = getPhase1Phases("service");

/** 현재 substep id 기준 substep 배열 생성. */
export function buildPhase1SubSteps(
  currentId: Phase1SubstepId,
  type?: PlanningType,
): SubStep[] {
  const defs = defsFor(type);
  const idx = defs.findIndex((s) => s.id === currentId);
  return defs.map((s, i) => ({
    id: s.id,
    label: s.label,
    status: i < idx ? "done" : i === idx ? "current" : "pending",
    path: i === idx ? undefined : s.path,
  }));
}

/** 이전 substep 정보 — StepActions prev 용. 첫 substep 이면 null. */
export function prevPhase1Substep(
  currentId: Phase1SubstepId,
  type?: PlanningType,
): SubstepDef | null {
  const defs = defsFor(type);
  const idx = defs.findIndex((s) => s.id === currentId);
  if (idx <= 0) return null;
  return defs[idx - 1];
}

/** 다음 substep 정보 — 마지막 substep(신청서 작성) 이면 신청 완료로 종료. */
export function nextPhase1Substep(
  currentId: Phase1SubstepId,
  type?: PlanningType,
): { label: string; path: string } {
  const defs = defsFor(type);
  const idx = defs.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx >= defs.length - 1) {
    return { label: "신청 완료", path: "/governance/forms/my" };
  }
  const next = defs[idx + 1];
  return { label: next.label, path: next.path };
}
