// 참조자(CC users) sessionStorage CRUD 헬퍼.
//
// Phase 1: 백엔드 컬럼이 없으므로 참조자 목록을 sessionStorage 에 영속.
//   - 저장 전(formId 없음): dh:gov:cc-users:draft-temp:{type} — 같은 유형 작성에 임시.
//   - 저장 후(formId 있음): dh:gov:cc-users:{formId} — 협의 단계 등에서 공유.
//   첫 저장 시 임시 키를 실제 키로 옮긴다(첨부 마이그레이션과 동일 패턴).
// Phase 2: RequestCcUser 테이블 + API 로 교체. read/write 시그니처는 유지.
//
// 참조자는 담당자 지정과 동일하게 이름 + 이메일로 다룬다. 이메일 기준 중복(대소문자 무시) 금지.

export interface CcUser {
  name: string;
  email: string;
}

const MAX_NAME_LEN = 50;

function key(formId: string): string {
  return `dh:gov:cc-users:${formId}`;
}
function draftKey(applicationType: string): string {
  return `dh:gov:cc-users:draft-temp:${applicationType}`;
}

/** 저장 데이터 정규화 — 구버전(string[]) 호환: 문자열이면 {name, email:""} 로 승격. */
function normalize(parsed: unknown): CcUser[] {
  if (!Array.isArray(parsed)) return [];
  const out: CcUser[] = [];
  parsed.forEach((item) => {
    if (typeof item === "string") {
      const name = item.trim();
      if (name) out.push({ name, email: "" });
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      const email = typeof o.email === "string" ? o.email.trim() : "";
      if (name) out.push({ name, email });
    }
  });
  return out;
}

function readKey(k: string): CcUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(k);
    if (!raw) return [];
    return normalize(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeKey(k: string, list: CcUser[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(k, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** formId 있으면 실제 키, 없으면 임시 키에서 참조자 목록을 읽는다. */
export function readCcUsers(formId: string | null, applicationType: string): CcUser[] {
  return readKey(formId ? key(formId) : draftKey(applicationType));
}

/** formId 있으면 실제 키, 없으면 임시 키에 참조자 목록을 저장한다. */
export function writeCcUsers(
  formId: string | null,
  applicationType: string,
  list: CcUser[],
): void {
  writeKey(formId ? key(formId) : draftKey(applicationType), list);
}

/** 첫 저장 시 임시 키의 참조자를 실제 form id 키로 옮기고 임시 키를 비운다. */
export function migrateCcUsers(
  formId: string,
  applicationType: string,
  list: CcUser[],
): void {
  if (typeof window === "undefined") return;
  writeKey(key(formId), list);
  try {
    sessionStorage.removeItem(draftKey(applicationType));
  } catch {
    /* ignore */
  }
}

/** 작성 화면 새 진입 시 임시 키를 1회 비운다(이전 작성분 잔존 방지). */
export function clearDraftCcUsers(applicationType: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(draftKey(applicationType));
  } catch {
    /* ignore */
  }
}

/** 참조자 1명 추가 — 검증 후 새 배열 반환. 실패 시 에러 메시지(string) 반환.
 *  성공 시 { list } 반환. (담당자 추가 모달과 동일한 반환 규약: 에러문구 또는 null) */
export function addCcUser(
  list: CcUser[],
  name: string,
  email: string,
): { list: CcUser[]; error: null } | { list: CcUser[]; error: string } {
  const n = name.trim();
  const e = email.trim();
  if (!n) return { list, error: "이름을 입력해 주세요." };
  if (n.length > MAX_NAME_LEN) return { list, error: "이름이 너무 깁니다." };
  if (!e) return { list, error: "이메일을 입력해 주세요." };
  if (list.some((u) => u.email.toLowerCase() === e.toLowerCase())) {
    return { list, error: "이미 추가된 참조자입니다." };
  }
  return { list: [...list, { name: n, email: e }], error: null };
}

/** 이메일 기준 제거. */
export function removeCcUser(list: CcUser[], email: string): CcUser[] {
  return list.filter((u) => u.email !== email);
}
