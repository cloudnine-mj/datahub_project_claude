// 담당자와 소통 채팅의 담당자 결정 로직.
//
// ── Phase 1 (현재) ──────────────────────────────────────────
// 사내 거버넌스 운영상 담당자가 김은솔 1 명으로 고정.
// FIXED_ASSIGNEE 상수를 그대로 반환.
//
// ── Phase 2 (추후) ──────────────────────────────────────────
// 신청 유형 / 지정 담당자(application.primaryAssignee) 에 따라 분기:
//   return application.primaryAssignee ?? application.assignees[0] ?? FIXED_ASSIGNEE;
// 분기 시점이 오면 본 함수 본문만 수정 — 호출부 시그니처는 유지.

import { FIXED_ASSIGNEE } from "@/lib/governance/forms/determine-reply-target";

export interface ChatAssignee {
  name: string;
  email: string;
  team?: string;
}

export function getChatAssignee(): ChatAssignee {
  return {
    name: FIXED_ASSIGNEE.name,
    email: FIXED_ASSIGNEE.email,
    team: "Governance팀",
  };
}
