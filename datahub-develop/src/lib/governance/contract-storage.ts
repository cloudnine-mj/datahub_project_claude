// 계약 단계(3/5) 계약 정보(EAS) sessionStorage CRUD 헬퍼.
//
// Phase 1: 백엔드 컬럼이 없으므로 EAS 품의번호를 sessionStorage 에 영속.
//   키 컨벤션 dh:gov:contract:{formId}. 품의번호 1개 고정(필드 증감 금지).
// Phase 2: GovernanceForm 에 contract 컬럼 추가 + API 로 교체.

export interface ContractInfo {
  /** EAS 발급 품의번호. */
  easApprovalNumber: string;
  /** 마지막 저장 시각(ISO). */
  updatedAt: string;
}

const KEY = (formId: string) => `dh:gov:contract:${formId}`;

function emptyInfo(): ContractInfo {
  return { easApprovalNumber: "", updatedAt: "" };
}

export function readContract(formId: string): ContractInfo {
  if (typeof window === "undefined") return emptyInfo();
  try {
    const raw = sessionStorage.getItem(KEY(formId));
    if (!raw) return emptyInfo();
    const parsed = JSON.parse(raw) as Partial<ContractInfo>;
    return {
      easApprovalNumber: String(parsed.easApprovalNumber ?? ""),
      updatedAt: String(parsed.updatedAt ?? ""),
    };
  } catch {
    return emptyInfo();
  }
}

export function writeContract(
  formId: string,
  patch: Partial<Pick<ContractInfo, "easApprovalNumber">>,
): ContractInfo {
  const current = readContract(formId);
  const next: ContractInfo = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(KEY(formId), JSON.stringify(next));
    } catch {
      /* 저장 실패해도 in-memory 상태 유지. */
    }
  }
  return next;
}
