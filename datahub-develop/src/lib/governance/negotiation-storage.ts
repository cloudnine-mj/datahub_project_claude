// 협의 단계(2/5) 합의 결과 sessionStorage CRUD 헬퍼.
//
// Phase 1: 백엔드 컬럼이 없으므로 합의 결과(선정 업체/금액/작업 기간/작업 건수)를
//   sessionStorage 에 영속. 키 컨벤션은 dh:gov:{도메인}:{formId} 유지.
// Phase 2: GovernanceForm 에 negotiation 컬럼(또는 별도 테이블) 추가 + API 로 교체.
//   본 파일의 read/write/lock 시그니처는 유지하고 내부 구현만 교체하면 됨.
//
// 합의 결과 4필드는 고정(임의 증감 금지). 작업 건수 초기값은 신청서 '목표 데이터 수량'.
// [계약 단계로 진행] 확정 시 locked=true 로 마킹해 이후 편집을 차단한다.

export interface NegotiationResult {
  /** 선정 업체 */
  selectedVendor: string;
  /** 금액 — 표시 포맷(1,200,000원)은 화면에서 처리. 저장은 원문 문자열. */
  amount: string;
  /** 작업 기간 — 예: 2026-06-01 ~ 2026-06-30 */
  period: string;
  /** 작업 건수 — 초기값은 신청서 목표 데이터 수량. */
  workCount: string;
  /** 계약 단계 전환 후 true → 합의 결과 잠금(편집 불가). */
  locked: boolean;
  /** 마지막 저장 시각(ISO). */
  updatedAt: string;
}

/** 합의 결과에서 입력해야 하는 4개 필드 키. locked/updatedAt 은 제외. */
export type NegotiationField =
  | "selectedVendor"
  | "amount"
  | "period"
  | "workCount";

export const NEGOTIATION_FIELDS: readonly NegotiationField[] = [
  "selectedVendor",
  "amount",
  "period",
  "workCount",
];

function emptyResult(): NegotiationResult {
  return {
    selectedVendor: "",
    amount: "",
    period: "",
    workCount: "",
    locked: false,
    updatedAt: "",
  };
}

const KEY = (formId: string) => `dh:gov:negotiation:${formId}`;

export function readNegotiation(formId: string): NegotiationResult {
  if (typeof window === "undefined") return emptyResult();
  try {
    const raw = sessionStorage.getItem(KEY(formId));
    if (!raw) return emptyResult();
    const parsed = JSON.parse(raw) as Partial<NegotiationResult>;
    return {
      selectedVendor: String(parsed.selectedVendor ?? ""),
      amount: String(parsed.amount ?? ""),
      period: String(parsed.period ?? ""),
      workCount: String(parsed.workCount ?? ""),
      locked: Boolean(parsed.locked),
      updatedAt: String(parsed.updatedAt ?? ""),
    };
  } catch {
    return emptyResult();
  }
}

function persist(formId: string, value: NegotiationResult): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY(formId), JSON.stringify(value));
  } catch {
    /* 용량 초과 등 — 저장 실패해도 in-memory 상태는 유지. */
  }
}

/** 4개 필드 중 일부를 갱신(merge). locked 상태면 변경 거부(현재 값 반환). */
export function writeNegotiation(
  formId: string,
  patch: Partial<Record<NegotiationField, string>>,
): NegotiationResult {
  const current = readNegotiation(formId);
  if (current.locked) return current;
  const next: NegotiationResult = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  persist(formId, next);
  return next;
}

/** 작업 건수 등 초기값 주입 — 저장된 값이 아직 없을 때만 한 번 채운다.
 *  이미 담당자가 입력/수정한 값은 덮어쓰지 않는다. */
export function ensureWorkCountDefault(
  formId: string,
  defaultWorkCount: string,
): NegotiationResult {
  const current = readNegotiation(formId);
  if (current.locked) return current;
  if (current.workCount.trim().length > 0) return current;
  if (defaultWorkCount.trim().length === 0) return current;
  const next: NegotiationResult = {
    ...current,
    workCount: defaultWorkCount,
    updatedAt: new Date().toISOString(),
  };
  persist(formId, next);
  return next;
}

/** 계약 단계 전환 확정 — 합의 결과 잠금. */
export function lockNegotiation(formId: string): NegotiationResult {
  const current = readNegotiation(formId);
  const next: NegotiationResult = {
    ...current,
    locked: true,
    updatedAt: new Date().toISOString(),
  };
  persist(formId, next);
  return next;
}

/** 비어 있는 필드 키 목록 — 모달 경고/진행 가드에 사용. */
export function emptyFields(value: NegotiationResult): NegotiationField[] {
  return NEGOTIATION_FIELDS.filter((k) => value[k].trim().length === 0);
}

/** 금액 표시 포맷 — 숫자만 있으면 1,200,000원, 아니면 원문 그대로. */
export function formatAmount(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  const digits = trimmed.replace(/[,\s]/g, "");
  if (/^\d+$/.test(digits)) {
    return `${Number(digits).toLocaleString("ko-KR")}원`;
  }
  return trimmed;
}
