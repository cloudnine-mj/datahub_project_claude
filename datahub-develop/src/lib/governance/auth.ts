/**
 * Governance BFF route 공용 인증/권한 헬퍼.
 *
 * datahub-web 의 `_check_form_owner` / `_check_form_message_writer` 등을
 * datahub-develop 의 `getSession()` + `getDbUser()` 패턴으로 치환.
 */

import { getSession } from "@/lib/session";
import { getDbUser } from "@/lib/db-user";

export interface GovernanceAuthContext {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  dbUser: NonNullable<Awaited<ReturnType<typeof getDbUser>>>;
  isAdmin: boolean;
}

/** 로그인된 사용자 + DB row 보장. 없으면 null. */
export async function requireGovernanceAuth(): Promise<GovernanceAuthContext | null> {
  const session = await getSession();
  if (!session) return null;
  const dbUser = await getDbUser(session);
  if (!dbUser) return null;
  return {
    session,
    dbUser,
    isAdmin: session.user.role === "ADMIN",
  };
}

/** Phase 1 고정 담당자 — 진행이력 채팅에서 요청자에게 회신 가능한 단일 담당자. */
export const FIXED_ASSIGNEE = {
  email: process.env.GOVERNANCE_ASSIGNEE_EMAIL ?? "kim.eunsol@company.com",
  name: process.env.GOVERNANCE_ASSIGNEE_NAME ?? "김은솔",
} as const;

export type GovernanceChatRole = "applicant" | "assignee" | "admin" | "observer";

/** 요청서에 대한 현재 사용자의 채팅 역할 판정.
 *  - 요청자 이메일 == me  → applicant
 *  - FIXED_ASSIGNEE 이메일 == me → assignee
 *  - ADMIN role → admin
 *  - 그 외 → observer (composer 미노출)
 */
export function resolveChatRole(
  form: { submitterEmail: string },
  auth: GovernanceAuthContext,
): GovernanceChatRole {
  const myEmail = auth.session.user.email.toLowerCase();
  if (myEmail === form.submitterEmail.toLowerCase()) return "applicant";
  if (myEmail === FIXED_ASSIGNEE.email.toLowerCase()) return "assignee";
  if (auth.isAdmin) return "admin";
  return "observer";
}

/** 채팅 발신자 역할에 따른 회신 대상 자동 결정 (datahub-web 의 determineReplyTarget 와 동일). */
export function resolveRecipient(
  form: { submitterName: string },
  senderRole: GovernanceChatRole,
): { name: string; role: "담당자" | "요청자" } {
  if (senderRole === "assignee") {
    return { name: form.submitterName, role: "요청자" };
  }
  return { name: FIXED_ASSIGNEE.name, role: "담당자" };
}
