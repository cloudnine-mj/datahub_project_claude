// 1단계(기획) substep + phase 정의 — 신청 유형(service / purchase / subscribe) 별로
//   다른 단계 구조를 반환하는 type-aware 헬퍼.
//
// service:    3 phase (1.기획 · 2.구축 · 3.적재). 1단계 substep 5 개.
// purchase:   2 phase (1.기획 · 2.적재). 1단계 substep 6 개 — 마지막에 '계약 체결' 추가.
// subscribe:  1 phase (1.기획 only). 1단계 substep 6 개 — 계약 체결까지가 종료점.
//             구독은 외부 업체 피드를 받기만 하므로 '적재' 별도 단계 없음.
//
// path 값은 모두 기존과 동일 — '계약 체결' 은 기존 /intake/build, 적재 substep 들은
// 기존 /intake/load 로 라우팅. UI/UX 와 라우트는 그대로 유지하고 데이터 정의만 변경.

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
  | "approval"
  | "approval-check"
  | "discussion"
  | "contract";

interface SubstepDef {
  id: Phase1SubstepId;
  label: string;
  path: string;
}

const SUBSTEP_DEFS_SERVICE: SubstepDef[] = [
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

const SUBSTEP_DEFS_PURCHASE_SUBSCRIBE: SubstepDef[] = [
  ...SUBSTEP_DEFS_SERVICE,
  // 계약 체결 — 구매·구독 한정으로 1단계 마지막에 위치. 본문은 기존 build 페이지 재사용.
  { id: "contract", label: "계약 체결", path: "/governance/forms/intake/build" },
];

function hasContractSubstep(type: PlanningType | undefined): boolean {
  // 계약 체결 substep 은 외부 업체와 계약하는 구매·구독 유형에만.
  return type === "purchase" || type === "subscribe";
}

function defsFor(type: PlanningType | undefined): SubstepDef[] {
  return hasContractSubstep(type) ? SUBSTEP_DEFS_PURCHASE_SUBSCRIBE : SUBSTEP_DEFS_SERVICE;
}

/** 유형별 phase pill 배열.
 *  - service:   1.기획 / 2.구축 / 3.적재 (3 phase)
 *  - purchase:  1.기획 / 2.적재 (2 phase, 구축 단계 없음)
 *  - subscribe: 1.기획 only (외부 피드 수신이라 적재 단계 없음) */
export function getPhase1Phases(type?: PlanningType): Phase[] {
  if (type === "subscribe") {
    return [{ id: "plan", label: "1. 기획", status: "current" }];
  }
  if (type === "purchase") {
    return [
      { id: "plan", label: "1. 기획", status: "current" },
      {
        id: "load",
        label: "2. 적재",
        status: "pending",
        path: "/governance/forms/intake/load",
      },
    ];
  }
  return [
    { id: "plan", label: "1. 기획", status: "current" },
    {
      id: "build",
      label: "2. 구축",
      status: "pending",
      path: "/governance/forms/intake/build",
    },
    {
      id: "load",
      label: "3. 적재",
      status: "pending",
      path: "/governance/forms/intake/load",
    },
  ];
}

/** 호환용 — 기본 phase (service 기준). 새 코드는 getPhase1Phases(type) 사용 권장. */
export const PHASE1_PHASES: Phase[] = getPhase1Phases("service");

/** 현재 substep id 기준 substep 배열 생성. type 미지정 시 service 기준 5 개.
 *  current 가 아닌 모든 항목에 path 부여 (데모용). */
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

/** 다음 substep 정보 — 마지막 substep 이면 phase 2 진입 정보 반환.
 *  - service: 마지막 다음은 /intake/build (2단계 구축)
 *  - purchase: 마지막은 contract(계약 체결) 다음 곧장 /intake/load (2단계 적재)
 *  - subscribe: 마지막은 contract — 적재 단계가 없으므로 신청 완료 안내(/forms/my) 로 종료 */
export function nextPhase1Substep(
  currentId: Phase1SubstepId,
  type?: PlanningType,
): { label: string; path: string } {
  const defs = defsFor(type);
  const idx = defs.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx >= defs.length - 1) {
    if (type === "subscribe") {
      return { label: "신청 완료", path: "/governance/forms/my" };
    }
    if (type === "purchase") {
      return { label: "2단계로 진행", path: "/governance/forms/intake/load" };
    }
    return { label: "2단계로 진행", path: "/governance/forms/intake/build" };
  }
  const next = defs[idx + 1];
  return { label: next.label, path: next.path };
}
