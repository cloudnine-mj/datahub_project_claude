// 답할 대상 결정 로직 — 메시지 발신자 역할 + 요청 정보 기반으로 자동 지정.
//
// Phase 1 (현재): 담당자 김은솔(고정) ↔ 요청자 양방향 회신 구조.
//   - 요청자 / potential-assignee / 어드민 → 김은솔에게 회신
//   - 김은솔(assignee) → 요청자에게 회신
//
// 사용자가 답할 대상을 선택할 필요 없음. UI 상 답할 대상은 정보 표시용 칩으로만 노출.
//
// Phase 2 (향후) — 담당자 다수 / chat assignee 지정 도입 시 아래 주석 로직으로 교체.
//   const primary = application.primaryAssignee ?? application.assignees[0];
//   if (sender.id === application.applicant.id) return primary;
//   if (application.assignees.some(a => a.id === sender.id)) return application.applicant;
//   // 어드민·기타: primary 담당자
//   return primary;

import type { PlanningType } from "./planning-config";

export type SenderRoleForChat = "applicant" | "assignee" | "potential-assignee" | "admin";

export interface ReplyTargetUser {
  name: string;
  /** '담당자' / '요청자' 같은 라벨. */
  role: "담당자" | "요청자";
}

export interface ApplicantInfo {
  name: string;
}

/** Phase 1 고정 담당자 — 추후 ROLE_MAPPING / DB 전환 시 이 상수 + 함수 본문만 수정. */
export const FIXED_ASSIGNEE: ReplyTargetUser & { email: string } = {
  name: "김은솔",
  role: "담당자",
  email: "kim.eunsol@company.com",
};

/** 메시지 발신자 기준으로 회신 대상자를 자동 결정.
 *  applicationType 은 Phase 2 에서 ROLE_MAPPING 분기에 사용 — 현재는 미사용(인자만 유지). */
export function determineReplyTarget(
  applicant: ApplicantInfo,
  senderRole: SenderRoleForChat,
  applicationType?: PlanningType,
): ReplyTargetUser {
  void applicationType; // Phase 2 예약

  // 담당자(김은솔 등)가 메시지를 작성하면 요청자에게 회신.
  if (senderRole === "assignee") {
    return { name: applicant.name, role: "요청자" };
  }
  // 그 외(요청자 본인 / 잠재 담당자 / 어드민) 는 고정 담당자에게 회신.
  return { name: FIXED_ASSIGNEE.name, role: FIXED_ASSIGNEE.role };
}
