// 거버넌스 요청 상세 페이지용 — 사용자 역할 판별 + 영역별 권한 함수.
//   현 사용자의 식별자(이름/이메일/email-local) 와 신청 정보를 비교해 5 가지 역할 분기.
//   admin 은 어떤 신청이든(본인 신청 외) 전체 편집 가능. demo 단계라 명시적 assignees
//   필드가 없는 경우 ROLE_MAPPING 으로 fallback.

import type { FormDetail, FormListItem, Me } from "./api";
import { isAssigneeByType } from "./roleMapping";

export type UserRoleForRequest =
  | "applicant"
  | "admin"
  | "assignee"
  | "potential-assignee"
  | "observer";

export function buildMyIdentifiers(me: Me | null): Set<string> | null {
  if (!me) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  const local = me.user.email.split("@")[0] ?? "";
  const set = new Set<string>([norm(me.user.name), norm(me.user.email), norm(local)]);
  set.delete("");
  return set;
}

export function determineUserRole(
  form: FormDetail | FormListItem,
  me: Me | null,
): UserRoleForRequest {
  if (!me) return "observer";
  const myIds = buildMyIdentifiers(me);
  if (!myIds) return "observer";

  // 1. 본인이 신청자 — 이메일 우선, 없으면 이름 비교
  const submitterEmail = ("submitter_email" in form ? form.submitter_email : "") ?? "";
  if (submitterEmail && submitterEmail.toLowerCase() === me.user.email.toLowerCase()) {
    return "applicant";
  }
  if (myIds.has(form.submitter_name.trim().toLowerCase())) {
    return "applicant";
  }

  // 2. 사이트 관리자 — 본인 신청이 아닌 한 모든 신청을 처리 가능 영역으로 진입.
  if (me.user.role === "admin") {
    return "admin";
  }

  // 3. 명시적으로 지정된 담당자(participants 배열)
  const participants = (form.participants ?? []).map((p) => p.trim().toLowerCase());
  if (participants.some((p) => myIds.has(p))) {
    return "assignee";
  }

  // 4. ROLE_MAPPING 의 primary/team — 신청 유형 기반 임시 매핑
  if (isAssigneeByType(form.form_type, myIds)) {
    return "potential-assignee";
  }

  return "observer";
}

// 영역별 편집 가능 여부.
// admin 은 potential-assignee 와 동급(담당자 지정 포함 전권).
export function canEditAssignment(role: UserRoleForRequest): boolean {
  return role === "potential-assignee" || role === "admin";
}
export function canEditNote(role: UserRoleForRequest): boolean {
  return role === "assignee" || role === "potential-assignee" || role === "admin";
}
export function canEditStatus(role: UserRoleForRequest): boolean {
  return role === "assignee" || role === "potential-assignee" || role === "admin";
}
export function showAssigneeActions(role: UserRoleForRequest): boolean {
  return role === "assignee" || role === "potential-assignee" || role === "admin";
}
