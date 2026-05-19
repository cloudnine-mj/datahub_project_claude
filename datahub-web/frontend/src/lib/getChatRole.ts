// 현재 로그인 사용자의 채팅 역할 판정 — composer 발신자 역할 + 회신 대상 자동 결정에 사용.
//   - 신청자 이메일 == me 이메일  → "applicant"  (신청자가 담당자에게 회신)
//   - me.user.role === "admin"     → "admin"      (어드민은 담당자에게 회신)
//   - me 이메일 == FIXED_ASSIGNEE  → "assignee"   (담당자가 신청자에게 회신)
//   - 그 외                         → "observer"   (composer 미노출)
//
// Phase 2 (담당자 다수) 도입 시 assignees 배열 검사로 확장.

import type { FormDetail, Me } from "./api";
import { FIXED_ASSIGNEE } from "./determineReplyTarget";
import type { SenderRoleForChat } from "./determineReplyTarget";

export type ChatRole = SenderRoleForChat | "observer";

export function getChatRole(form: FormDetail | null, me: Me | null): ChatRole {
  if (!form || !me) return "observer";
  const myEmail = me.user.email.toLowerCase();
  if (myEmail === form.submitter_email.toLowerCase()) return "applicant";
  if (myEmail === FIXED_ASSIGNEE.email.toLowerCase()) return "assignee";
  if (me.user.role === "admin") return "admin";
  return "observer";
}
