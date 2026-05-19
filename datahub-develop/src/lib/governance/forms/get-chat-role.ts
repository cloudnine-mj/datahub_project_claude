/**
 * 현재 로그인 사용자의 채팅 역할 판정 — composer 발신자 역할 결정 + 회신 대상 자동 지정.
 * datahub-web `lib/getChatRole.ts` 포팅.
 *
 * 서버 사이드 `lib/governance/auth.ts::resolveChatRole` 와 동일 로직.
 * 클라이언트에서는 `me` 가 platform_token 세션에서 받은 PlatformSessionUser.
 */

import type { SenderRoleForChat } from "./determine-reply-target";

export type ChatRole = SenderRoleForChat | "observer";

interface FormLike {
  submitterEmail: string;
}

interface MeLike {
  email: string;
  /** "USER" | "ADMIN" (datahub-api role). */
  role?: string;
}

/** Phase 1 고정 담당자 이메일 — server-side `GOVERNANCE_ASSIGNEE_EMAIL` 와 동일해야 함.
 *  client 에서는 NEXT_PUBLIC_GOVERNANCE_ASSIGNEE_EMAIL 로 노출 가능 (옵션). */
const FIXED_ASSIGNEE_EMAIL =
  process.env.NEXT_PUBLIC_GOVERNANCE_ASSIGNEE_EMAIL ??
  "kim.eunsol@company.com";

export function getChatRole(form: FormLike | null, me: MeLike | null): ChatRole {
  if (!form || !me) return "observer";
  const myEmail = me.email.toLowerCase();
  if (myEmail === form.submitterEmail.toLowerCase()) return "applicant";
  if (myEmail === FIXED_ASSIGNEE_EMAIL.toLowerCase()) return "assignee";
  if (me.role === "ADMIN" || me.role === "admin") return "admin";
  return "observer";
}
