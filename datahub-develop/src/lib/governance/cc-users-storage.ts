// 참조자(CC users) sessionStorage CRUD 헬퍼.
//
// Phase 1: 백엔드 컬럼이 없으므로 참조자 이름 배열을 sessionStorage 에 영속.
//   - 저장 전(formId 없음): dh:gov:cc-users:draft-temp:{type} — 같은 유형 작성에 임시.
//   - 저장 후(formId 있음): dh:gov:cc-users:{formId} — 협의 단계 등에서 공유.
//   첫 저장 시 임시 키를 실제 키로 옮긴다(첨부 마이그레이션과 동일 패턴).
// Phase 2: RequestCcUser 테이블 + API 로 교체. read/write 시그니처는 유지.
//
// 참조자는 이름 문자열만 다룬다(이메일·검색 없음). 한 이름 50자 제한, 중복(대소문자 무시) 금지.

const MAX_NAME_LEN = 50;

function key(formId: string): string {
  return `dh:gov:cc-users:${formId}`;
}
function draftKey(applicationType: string): string {
  return `dh:gov:cc-users:draft-temp:${applicationType}`;
}

function readKey(k: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(k);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeKey(k: string, list: string[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(k, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** formId 있으면 실제 키, 없으면 임시 키에서 참조자 목록을 읽는다. */
export function readCcUsers(formId: string | null, applicationType: string): string[] {
  return readKey(formId ? key(formId) : draftKey(applicationType));
}

/** formId 있으면 실제 키, 없으면 임시 키에 참조자 목록을 저장한다. */
export function writeCcUsers(
  formId: string | null,
  applicationType: string,
  list: string[],
): void {
  writeKey(formId ? key(formId) : draftKey(applicationType), list);
}

/** 첫 저장 시 임시 키(draft-temp:{type}) 의 참조자를 실제 form id 키로 옮기고 임시 키를 비운다.
 *  임시 키가 비어 있어도 현재 메모리 목록(list)을 실제 키에 보장 저장한다. */
export function migrateCcUsers(
  formId: string,
  applicationType: string,
  list: string[],
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

/** 이름 1개 추가 — trim 후 빈 값/중복(대소문자 무시)/길이초과면 무시하고 기존 배열 반환.
 *  추가되면 새 배열, 아니면 동일 참조 배열을 반환(호출부에서 변경 여부 판단 가능). */
export function addCcUser(list: string[], raw: string): string[] {
  const name = raw.trim();
  if (!name) return list;
  if (name.length > MAX_NAME_LEN) return list;
  const lower = name.toLowerCase();
  if (list.some((n) => n.toLowerCase() === lower)) return list;
  return [...list, name];
}

/** 이름 1개 제거. */
export function removeCcUser(list: string[], name: string): string[] {
  return list.filter((n) => n !== name);
}
