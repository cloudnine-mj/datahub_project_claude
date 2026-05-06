/**
 * 정책 작성 폼의 예시 데이터 — severity 별 3종.
 *
 * Admin 이 "예시 보기" 버튼 클릭 시 모달로 보여주거나,
 * "이 예시로 채우기" 클릭 시 폼 필드에 자동 입력하는 데 사용한다.
 *
 * 시드(`backend/app/seed.py`)의 정책 항목 + 권장/참고용 모범 사례를 추가.
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
  category: "정책",
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
  category: "가이드",
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

const REFERENCE_EXAMPLE: PolicyExample = {
  label: "데이터 활용 사례집 (참고 — 모범 작성 사례)",
  title: "데이터 활용 사례집",
  category: "FAQ",
  summary: "사내 팀들이 DataHub 데이터를 어떻게 활용했는지 모은 참고 자료입니다.",
  tags: ["활용", "사례", "참고"],
  severity: "reference",
  applies_to: "데이터 활용 아이디어를 찾는 누구나",
  tldr:
    "이 문서는 강제 사항이 아닙니다. 다른 팀의 활용 사례를 살펴보고 " +
    "본인 프로젝트에 영감을 얻는 용도로 활용하세요.",
  action_items: [
    "관심 도메인의 사례부터 읽기",
    "유사 사례가 있다면 해당 팀에 직접 문의해 협업",
    "본인 활용 사례도 공유하고 싶으면 이 페이지에 댓글/링크 첨부",
  ],
  content:
    "1. 마케팅 — 고객 세그먼트 분석\n매출·행동 데이터를 결합해 타겟 정밀도를 향상시킨 사례.\n\n" +
    "2. 물류 — 배송 ETA 모델\n과거 배송 로그로 지역별 ETA 정확도를 개선한 사례.\n\n" +
    "3. 추천 — 콘텐츠 개인화\n이용 이력 + 메타데이터로 추천 정확도를 끌어올린 사례.",
  examples:
    "참고: 자세한 사례별 결과는 사내 위키 또는 담당팀에 문의하세요.\n" +
    "이 페이지는 시작점일 뿐, 결정 근거는 각 사례의 원문에서 확인해야 합니다.",
};

/** severity → 예시 매핑. 모달이 현재 severity 컨텍스트로 자동 선택. */
export const POLICY_EXAMPLES: Record<Severity, PolicyExample> = {
  required: REQUIRED_EXAMPLE,
  recommended: RECOMMENDED_EXAMPLE,
  reference: REFERENCE_EXAMPLE,
};

/** 후방 호환 — 단일 예시가 필요한 곳에서 사용 (기본은 필수). */
export const POLICY_EXAMPLE: PolicyExample = REQUIRED_EXAMPLE;
