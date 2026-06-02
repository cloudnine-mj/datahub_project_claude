// 사용자 디렉터리 — 담당자/참조자 지정 시 드롭다운 선택용 사용자 목록.
//
// Phase 1: mock 목록. MS SSO 로그인 시 datahub-api 의 get_or_create_user 로 저장되는
//   사용자들을 흉내낸 고정 데이터.
// Phase 2: 아래 searchUsers 본문만 datahub-api 의 `GET /users/search?q=` 호출로 교체하면 됨
//   (응답 {id, email, name} → DirectoryUser 로 매핑). 호출부 시그니처는 유지.

export interface DirectoryUser {
  name: string;
  email: string;
}

// 사내 구성원 mock — 실제로는 로그인 이력이 있는 사용자가 여기 채워진다(Phase 2).
const MOCK_USERS: DirectoryUser[] = [
  { name: "김은솔", email: "kim.eunsol@company.com" },
  { name: "강민정", email: "minjeong914.kang@lgresearch.ai" },
  { name: "이박사", email: "lee.phd@company.com" },
  { name: "김팀장", email: "kim.lead@company.com" },
  { name: "박과장", email: "park.manager@company.com" },
  { name: "정수민", email: "soomin.jung@company.com" },
  { name: "최영호", email: "youngho.choi@company.com" },
  { name: "한지우", email: "jiwoo.han@company.com" },
];

/** 이름 또는 이메일로 사용자 검색. q 가 비면 전체(상위 limit) 반환.
 *  Phase 2: 이 함수 본문을 `GET /users/search?q=` 호출로 교체. */
export function searchUsers(q: string, limit = 20): DirectoryUser[] {
  const query = q.trim().toLowerCase();
  const matched = query
    ? MOCK_USERS.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      )
    : MOCK_USERS;
  return matched.slice(0, limit);
}
