// '내 업무만 보기' 필터용 임시 역할 매핑.
//   TODO: 추후 DB 기반 역할 관리(예: form_assignees 테이블) 로 전환.
//         현재는 데모 단계라 신청 유형별 기본 담당자 이름을 하드코딩.
//
// 매칭 규칙: FormListItem.form_type 이 매핑 키에 있고, 현재 사용자의
// name / email / email-local 중 하나가 teamMembers 에 포함되면 본인을
// 해당 신청의 담당자로 간주.

import type { FormType } from "./types";

interface RoleEntry {
  /** 신청 유형별 1차 담당자 — 정보 표시·통계용. 매칭은 teamMembers 기준. */
  primaryAssignee: string;
  /** 본인 매칭에 사용할 식별자(소문자 비교). 이름 / 이메일 / 이메일 로컬파트 모두 가능. */
  teamMembers: string[];
}

export const ROLE_MAPPING: Partial<Record<FormType, RoleEntry>> = {
  data_purchase: {
    primaryAssignee: "박용민",
    teamMembers: ["박용민", "park.yongmin", "park.yongmin@company.com"],
  },
  data_subscription: {
    primaryAssignee: "박용민",
    teamMembers: ["박용민", "park.yongmin", "park.yongmin@company.com"],
  },
  data_production: {
    primaryAssignee: "김은솔",
    teamMembers: ["김은솔", "kim.eunsol", "kim.eunsol@company.com"],
  },
  // api_usage_plan: 사용자 단독 진행 — 별도 담당자 없음.
};

/** 현재 사용자의 식별자 후보(이름/이메일/로컬파트) 가 형식 유형의
 *  teamMembers 와 교집합을 가지면 true. */
export function isAssigneeByType(
  formType: FormType,
  myIdentifiers: Set<string> | null,
): boolean {
  if (!myIdentifiers) return false;
  const entry = ROLE_MAPPING[formType];
  if (!entry) return false;
  for (const m of entry.teamMembers) {
    if (myIdentifiers.has(m.toLowerCase())) return true;
  }
  return false;
}
