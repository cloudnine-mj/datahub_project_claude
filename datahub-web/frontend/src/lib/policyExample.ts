/**
 * 정책 작성 폼의 예시 데이터 — severity 별 4종.
 *
 * Admin 이 "예시 보기" 버튼 클릭 시 모달로 보여주거나,
 * "이 예시로 채우기" 클릭 시 폼 필드에 자동 입력하는 데 사용한다.
 *
 * 분류 4단계 (사용자 여정 분석 Step 2 의 태그 예시 그대로):
 *   필수 / 권장 / 보안 / 승인 필요
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
  label: "데이터 적재 정책 (필수 — 모범 작성 사례)",
  title: "데이터 적재 정책",
  category: "데이터 관리 정책",
  summary: "신규 데이터셋 등록 시 메타데이터·라이선스·소유권 검증을 필수화합니다.",
  tags: ["적재", "라이선스", "메타데이터"],
  severity: "required",
  applies_to: "신규 데이터셋을 등록하는 모든 데이터 등록자",
  tldr:
    "새 데이터셋을 등록하기 전에 라이선스·소유권·PII 여부를 확인하고, " +
    "필수 메타데이터 5개 항목을 빠짐없이 채우세요.",
  action_items: [
    "데이터셋 출처/소유권 확인",
    "라이선스 명시 (CC-BY, 사내 전용 등)",
    "PII 포함 여부 확인 — 포함 시 보안팀 사전 승인",
    "메타데이터 5종 입력 (이름, 설명, 출처, 갱신주기, 담당자)",
    "Compliance 담당자 사인오프",
  ],
  content:
    "1. 적용 대상\n신규 데이터셋을 DataHub 에 등록하는 모든 사용자.\n\n" +
    "2. 등록 절차\n등록 화면에서 메타데이터 5개 항목을 입력하고, " +
    "라이선스·소유권 정보를 명시해야 합니다.\n\n" +
    "3. PII 데이터\n개인정보가 포함된 경우 보안팀의 사전 승인이 필수입니다.",
  examples:
    "올바른 사례\n- 라이선스: CC-BY-4.0 명시, 출처 URL 첨부, 담당자 이메일 기재\n\n" +
    "잘못된 사례\n- 라이선스 미기재, 메타데이터 항목 누락, PII 포함 데이터를 무신고 등록",
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

const SECURITY_EXAMPLE: PolicyExample = {
  label: "개인정보 처리 가이드 (보안 — 모범 작성 사례)",
  title: "개인정보 처리 가이드",
  category: "데이터 관리 정책",
  summary: "PII 가 포함된 데이터셋 처리 시 준수해야 할 보안·접근 제어 가이드입니다.",
  tags: ["보안", "PII", "비식별화"],
  severity: "security",
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

const APPROVAL_REQUIRED_EXAMPLE: PolicyExample = {
  label: "외부 데이터 공유 절차 (승인 필요 — 모범 작성 사례)",
  title: "외부 데이터 공유 승인 절차",
  category: "데이터 관리 정책",
  summary: "외부 조직·파트너와 데이터를 공유하기 전 거쳐야 하는 사전 승인 절차입니다.",
  tags: ["공유", "외부", "승인"],
  severity: "approval_required",
  applies_to: "외부 조직·파트너와 데이터 공유 협력을 진행하려는 모든 사용자",
  tldr:
    "외부 조직과 데이터를 공유하기 전, 공유 범위·라이선스·기간을 명시한 " +
    "공유 신청서를 제출하고 데이터 오너 + Compliance + 법무팀의 승인을 받아야 합니다.",
  action_items: [
    "공유 대상 데이터셋·범위 식별",
    "공유 신청서 작성 (대상 조직, 사용 목적, 보유 기간)",
    "데이터 오너 1차 승인",
    "Compliance + 법무팀 검토",
    "승인 후 공유 채널·접근 권한 설정",
  ],
  content:
    "1. 적용 대상\n사내 데이터를 외부 조직(파트너·연구기관·고객사 등)과 공유하려는 모든 사용자.\n\n" +
    "2. 승인 단계\n① 데이터 오너 → ② Compliance 팀 → ③ 법무팀 자문 → ④ 최종 승인.\n" +
    "각 단계에서 반려 사유가 있을 경우 신청자에게 회신됩니다.\n\n" +
    "3. 사후 관리\n승인된 공유는 분기별로 사용 현황을 점검하며, 보유 기간 만료 시 자동 폐기.",
  examples:
    "올바른 사례\n- 공유 신청서에 대상 조직·범위·기간 명시 + 법무팀 자문 결과 첨부\n\n" +
    "잘못된 사례\n- 사전 승인 없이 외부 이메일로 데이터 전송\n- 보유 기간 미지정 상태로 공유",
};

/** severity → 예시 매핑. 모달이 현재 severity 컨텍스트로 자동 선택. */
export const POLICY_EXAMPLES: Record<Severity, PolicyExample> = {
  required: REQUIRED_EXAMPLE,
  recommended: RECOMMENDED_EXAMPLE,
  security: SECURITY_EXAMPLE,
  approval_required: APPROVAL_REQUIRED_EXAMPLE,
};

/** 후방 호환 — 단일 예시가 필요한 곳에서 사용 (기본은 필수). */
export const POLICY_EXAMPLE: PolicyExample = REQUIRED_EXAMPLE;
