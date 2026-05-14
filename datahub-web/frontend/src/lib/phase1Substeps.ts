// 1단계(기획) 5개 substep 정의 + 현재 substep 기준 stepper / prev / next 생성 헬퍼.
//   각 페이지에서 동일한 5-substep 배열을 직접 작성하지 않도록 공용 헬퍼로 분리.

import type { Phase, SubStep } from "@/components/ProcessStepper";

export type Phase1SubstepId =
  | "planning"
  | "form"
  | "approval"
  | "approval-check"
  | "discussion";

interface SubstepDef {
  id: Phase1SubstepId;
  label: string;
  path: string;
}

const SUBSTEP_DEFS: SubstepDef[] = [
  { id: "planning", label: "계획 수립", path: "/governance/forms/planning" },
  { id: "form", label: "신청서 작성", path: "/governance/forms/intake" },
  { id: "approval", label: "전자결재 품의", path: "/governance/forms/approval" },
  {
    id: "approval-check",
    label: "결재 승인 확인",
    path: "/governance/forms/approval-check",
  },
  {
    id: "discussion",
    label: "담당자 논의·확정",
    path: "/governance/forms/discussion",
  },
];

/** 1단계 phase pill 배열 — 모든 1단계 substep 페이지에서 동일. */
export const PHASE1_PHASES: Phase[] = [
  { id: "plan", label: "1. 기획", status: "current" },
  { id: "build", label: "2. 구축", status: "pending" },
  { id: "load", label: "3. 적재", status: "pending" },
];

/** 현재 substep id 기준 5-substep 배열 생성. done 항목엔 path 부여, 그 외엔 미부여. */
export function buildPhase1SubSteps(currentId: Phase1SubstepId): SubStep[] {
  const idx = SUBSTEP_DEFS.findIndex((s) => s.id === currentId);
  return SUBSTEP_DEFS.map((s, i) => ({
    id: s.id,
    label: s.label,
    status: i < idx ? "done" : i === idx ? "current" : "pending",
    path: i < idx ? s.path : undefined,
  }));
}

/** 이전 substep 정보 — StepActions prev 용. 첫 substep 이면 null. */
export function prevPhase1Substep(currentId: Phase1SubstepId): SubstepDef | null {
  const idx = SUBSTEP_DEFS.findIndex((s) => s.id === currentId);
  if (idx <= 0) return null;
  return SUBSTEP_DEFS[idx - 1];
}

/** 다음 substep 정보 — 마지막 substep 이면 phase 2 진입 정보 반환. */
export function nextPhase1Substep(currentId: Phase1SubstepId): {
  label: string;
  path: string;
} {
  const idx = SUBSTEP_DEFS.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx >= SUBSTEP_DEFS.length - 1) {
    return { label: "2단계로 진행", path: "/governance/forms/intake/build" };
  }
  const next = SUBSTEP_DEFS[idx + 1];
  return { label: `${next.label}으로`, path: next.path };
}
