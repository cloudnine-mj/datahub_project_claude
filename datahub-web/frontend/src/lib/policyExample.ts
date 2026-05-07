/**
 * 정책 작성 폼의 예시 데이터 — severity 별 2종 (필수/권장).
 *
 * 보안·승인 같은 분류는 자유 tags 로 표현 (예: tags=["보안", "PII"]).
 * Admin 이 "예시 보기" 버튼 클릭 시 모달로 보여주거나,
 * "이 예시로 채우기" 클릭 시 폼 필드에 자동 입력하는 데 사용.
 */

import type { Severity } from "./api";

export interface PolicyExample {
  /** 작성자가 식별할 라벨 — 모달에서 예시 이름으로 사용 */
  label: string;
  title: string;
  category: string;
  content: string;
  // 메타필드
  summary: string;
  tags: string[];
  severity: Severity;
  applies_to: string;
  tldr: string;
  action_items: string[];
  examples: string;
}

const REQUIRED_EXAMPLE: PolicyExample = {
  label: "개인정보 처리 가이드 (필수 — 모범 작성 사례)",
  title: "개인정보 처리 가이드",
  category: "데이터 관리 정책",
  summary: "PII 가 포함된 데이터셋 처리 시 준수해야 할 보안·접근 제어 가이드입니다.",
  tags: ["보안", "PII", "비식별화", "승인 필요"],
  severity: "required",
  applies_to: "PII (이메일·전화·주민번호 등) 포함 데이터를 다루는 모든 사용자",
  tldr:
    "PII 데이터는 반드시 비식별화 처리 후 등록하고, 접근 권한은 " +
    "최소 인원으로 제한하세요. 외부 공유 전 보안팀 승인 필수.",
  action_items: [
    "PII 컬럼 식별 및 비식별화 처리 (해싱·마스킹)",
    "접근 권한을 최소 필요 인원으로 제한",
    "외부 공유 시 보안팀 승인 획득",
    "보유 기간 명시 — 만료 후 자동 삭제 정책 적용",
  ],
  content:
    "1. PII 정의\n이메일·전화번호·주민번호·계좌번호·주소 등 개인을 식별할 수 " +
    "있는 정보.\n\n" +
    "2. 처리 원칙\n수집-목적-보유 원칙에 따라 최소한의 정보만 보유하고, " +
    "목적 달성 후 즉시 폐기합니다.\n\n" +
    "3. 접근 제어\nPII 가 포함된 데이터셋은 ACL 그룹으로만 접근 가능하며, " +
    "그룹 가입은 데이터 오너 + 보안팀의 이중 승인이 필요합니다.",
  examples:
    "올바른 사례\n- 이메일을 SHA-256 해시로 변환 후 저장\n- 접근 권한을 4명 핵심 분석가로 제한\n\n" +
    "잘못된 사례\n- 원본 PII 를 평문 저장\n- 전사에 공유 권한 부여",
};

const RECOMMENDED_EXAMPLE: PolicyExample = {
  label: "데이터셋 명명 컨벤션 (권장 — 모범 작성 사례)",
  title: "데이터셋 명명 컨벤션",
  category: "데이터 관리 정책",
  summary: "데이터셋 이름을 일관된 규칙으로 작성해 검색·식별을 쉽게 만듭니다.",
  tags: ["명명", "메타데이터", "검색"],
  severity: "recommended",
  applies_to: "데이터셋을 등록·운영하는 모든 사용자",
  tldr:
    "데이터셋 이름은 `{도메인}-{용도}-{버전}` 형식 (소문자·하이픈) 으로 작성해 " +
    "팀 간 검색과 자동화 처리에서 충돌을 줄이세요.",
  action_items: [
    "소문자 + 하이픈만 사용 (공백·언더스코어 X)",
    "도메인-용도-버전 3단 구성 유지 (예: marketing-segment-v2)",
    "버전 미지정 시 기본 v1 명시",
    "약어 대신 풀네임 권장 — 단 사내 표준 약어는 허용",
  ],
  content:
    "1. 형식\n`{도메인}-{용도}-{버전}` (예: marketing-segment-v2, " +
    "logistics-route-v1).\n\n" +
    "2. 길이\n전체 60자 이내. 너무 길면 검색·UI 표시에 불리합니다.\n\n" +
    "3. 갱신\n스키마 호환성이 깨질 때만 버전을 올리고, 그 외에는 동일 이름을 유지합니다.",
  examples:
    "올바른 사례\n- marketing-segment-v2\n- logistics-route-eta-v1\n\n" +
    "잘못된 사례\n- MarketingSegment2 (대문자 + 형식 미준수)\n- mkt_seg_v2 (언더스코어 + 약어 남용)",
};

/** severity → 예시 매핑. 모달이 현재 severity 컨텍스트로 자동 선택. */
export const POLICY_EXAMPLES: Record<Severity, PolicyExample> = {
  required: REQUIRED_EXAMPLE,
  recommended: RECOMMENDED_EXAMPLE,
};

/** 후방 호환 — 단일 예시가 필요한 곳에서 사용 (기본은 필수). */
export const POLICY_EXAMPLE: PolicyExample = REQUIRED_EXAMPLE;
