/**
 * 신청 5종의 필드 스키마 — 화면 9/10 의 폼 구조를 데이터화.
 *
 * 폼 자동 렌더링 + 백엔드 payload(JSON) 매핑에 사용. 새 신청 추가 시 여기만 수정하면
 * 작성/상세 양쪽이 자동 반영된다.
 */

import type { FormType } from "./api";

export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  /** API 활용 계획서 — 동적 서비스명 리스트 (+서비스 추가) */
  | "service_list"
  /** API 활용 계획서 — 시작일 ~ 종료일 한 행 입력 */
  | "date_range"
  /** API 활용 계획서 — USD/KRW/기타(+직접 입력) */
  | "currency"
  /** 업무생산성 도구 신청 — 서비스 블록 동적 리스트 (서비스 N + 내부 다중 필드) */
  | "service_blocks"
  /** 통화 단위(currencyKey 가 가리키는 필드)에 맞춰 prefix/suffix 가 붙는 금액 입력 */
  | "amount_with_currency"
  /** 결재선 — 이름을 한 명씩 입력 후 Enter 로 추가하는 칩 리스트. 값은 string[]. */
  | "approver_list";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  /**
   * 필드 아래 안내 텍스트. `{link}` 토큰을 포함하면 그 자리에
   * `hintLink.label` 이 클릭 가능한 링크로 인라인 삽입됨.
   * 토큰이 없으면 hint 와 hintLink 가 줄바꿈으로 분리되어 표시.
   */
  hint?: string;
  /** hint 안의 `{link}` 자리 또는 hint 아래에 노출되는 보조 링크 */
  hintLink?: { url: string; label: string };
  /**
   * 특정 값일 때만 hint 를 노출. (radio/select 같이 enum 값을 가지는 필드 용도)
   * 미지정 시 hint 는 값과 무관하게 항상 노출.
   */
  hintWhen?: string | string[];
  /**
   * hint 노출 톤.
   *   'gray' (기본) — secondary 회색 단락 텍스트
   *   'amber'       — amber 배경 박스 + ti-alert-circle 아이콘. 추가 검토 안내 등 강조용.
   *   'info'        — info 배경 박스 + ti-info-circle 아이콘.
   */
  hintTone?: "gray" | "amber" | "info";
  /**
   * true 면 다음 필드를 같은 행(행 1개)에 인라인으로 함께 렌더링.
   * 다음 필드의 label 이 두 입력 사이에 인라인 레이블로 배치됨.
   * 예: 목표 데이터 수량(number) → 단위(text) 를 한 줄에.
   */
  inlineWithNext?: boolean;
  /**
   * amount_with_currency 타입 전용 — 통화를 가져올 다른 필드의 key.
   * 해당 필드는 currency 타입이어야 함 ({kind?: 'USD'|'KRW'|'기타', custom?: string}).
   */
  currencyKey?: string;
}

/**
 * 데이터셋 저장 레포지토리 — 신청에서 선택 가능한 사전 정의 목록.
 *
 * 추후 백엔드에서 동적으로 받아올 수도 있으나(예: GET /repositories),
 * 현재는 데모용으로 고정 목록 사용. 시드된 'analytics-platform-repo' 도 포함.
 */
export const DATASET_REPOSITORIES = [
  "analytics-platform-repo",
  "marketing-data-repo",
  "logistics-data-repo",
  "product-log-repo",
  "research-experiment-repo",
  "security-data-repo",
];

export interface SectionDef {
  title: string;
  /** true 면 섹션 전체가 선택사항 — 헤더에 * 미표시, 빈 필드여도 제출 가능. 기본 false. */
  optional?: boolean;
  fields: FieldDef[];
}

export interface FormSchema {
  type: FormType;
  label: string;
  /** 헤더용 짧은 설명 */
  description?: string;
  /** project_name 으로 매핑되는 필드 key — 목록 화면에 노출 */
  projectField: string;
  sections: SectionDef[];
}

// 화면 10 — 데이터 용역 제작 신청
const dataProduction: FormSchema = {
  type: "data_production",
  label: "데이터 용역 제작 신청",
  description: "외주 업체에 데이터 라벨링·수집·검수 작업을 의뢰할 때",
  projectField: "관련_프로젝트_PMS",
  sections: [
    {
      title: "요청 정보",
      fields: [
        { key: "관련_프로젝트_PMS", label: "관련 프로젝트 (PMS 기준)", type: "text", placeholder: "데이터셋이 활용되는 프로젝트명을 기재해 주세요 (복수 기재 가능, PMS 기준)", required: true },
        { key: "데이터셋_활용_목적", label: "데이터셋 활용 목적", type: "textarea", placeholder: "데이터셋을 활용하는 목적을 기재해 주세요 (서비스 기능 평가)" },
        { key: "데이터셋_이름", label: "데이터셋 이름", type: "text" },
        { key: "희망_작업_착수일", label: "희망 작업 착수일", type: "date" },
        { key: "희망_수령일", label: "희망 수령일", type: "date" },
      ],
    },
    {
      title: "데이터셋 공유 동의",
      fields: [
        {
          key: "접근_권한",
          label: "접근 권한",
          type: "radio",
          options: ["전사에 공유", "제한된 사용자"],
        },
      ],
    },
    {
      title: "작업 요청 사항",
      fields: [
        { key: "작업_형태", label: "작업 형태", type: "text", placeholder: "e.g., 대화, 점수 매기기, AB 테스트, 다차원 레이블링, 한영 번역 검수, OCR, 문서 수집, 문서 QA" },
        { key: "작업_도구", label: "작업 도구", type: "text", placeholder: "엑셀 or 외주 업체 자체 툴 (별도로 원하는 도구가 있으시면 적어 주세요! e.g., Gradio)" },
        { key: "목표_데이터_수량", label: "목표 데이터 수량", type: "number", placeholder: "숫자만 입력", inlineWithNext: true },
        { key: "단위", label: "단위", type: "text", placeholder: "e.g., 문장, 문항" },
        { key: "목표_데이터_수량_상세", label: "목표 데이터 수량 (상세)", type: "textarea", placeholder: "필요 시 수량에 대한 세부 사항 기재 (e.g., 대화 1턴당 문장 최소 10개 → 최소 50만 문장)" },
        { key: "데이터_1개당_필요_작업자", label: "데이터 1개당 필요 작업자", type: "text", placeholder: "**명 (동일 데이터에 여러 작업자의 의견이 필요하면 1명 이상 기재)" },
        { key: "작업자_보유_기술", label: "작업자 보유 기술", type: "text", placeholder: "e.g. SQL 활용 가능, 원어민 수준 영어 독해 능력" },
      ],
    },
    {
      title: "데이터 검수 / 평가 계획",
      fields: [
        { key: "품질_평가_방식", label: "품질 평가 방식", type: "textarea", placeholder: "e.g. 데이터 전수 확인, 랜덤 샘플링, 모델 학습 후 벤치마크 점수" },
        { key: "품질_평가_기준", label: "품질 평가 기준", type: "textarea", placeholder: "없을 경우, 데이터 제작 시 가장 중요하게 고려해야 할 요소를 적어 주세요." },
        { key: "평가_주기", label: "평가 주기", type: "text", placeholder: "e.g. 주 1회 정기 검수 진행, 데이터 납품 시마다 진행 (최소 중간 평가 1회 이상 필수 권장)" },
      ],
    },
    {
      title: "기타 유의 사항",
      optional: true,
      fields: [
        {
          key: "기타_유의_사항",
          label: "내용",
          type: "textarea",
          hint: "위에서 설명하지 못한 기타 유의 사항이 있으면 적어 주세요.",
          placeholder: "예: 이런 주제로 대화하지 말아 주세요 (정치, 위험 행동 지시, 미래 예측)",
        },
      ],
    },
    {
      title: "파일 첨부 체크리스트",
      optional: true,
      fields: [
        { key: "체크_샘플_데이터", label: "다양성이 있는 샘플 데이터를 직접 제작하여 최소 5개 보내 주세요. (작업자 분들의 이해도가 올라가 데이터의 품질이 향상됩니다.)", type: "checkbox" },
        { key: "체크_가이드라인", label: "작업자 분들에게 전달할 작업 가이드라인을 보내 주세요. 데이터 팀에 요청할 별도 사항이 있으시면 별도의 파일을 첨부해 주세요.", type: "checkbox" },
        { key: "체크_PoC_입력", label: "입력 데이터 / 소스 데이터가 필요한 작업일 경우 PoC 작업용으로 소량 우선 제공해 주세요.", type: "checkbox" },
      ],
    },
  ],
};

// 화면 9 — 데이터 구매 신청
// 데이터 구매/구독 공통 Compliance 라디오 — '확인 필요' 선택 시 amber 안내 노출.
const COMPLIANCE_FIELD: FieldDef = {
  key: "compliance_확인_여부",
  label: "Compliance 확인 여부",
  type: "radio",
  options: ["확인 완료", "확인 필요"],
  required: true,
  hint:
    "신청서 제출 후 Compliance 팀의 추가 검토가 진행됩니다. 라이선스 검토 결과에 따라 계약 조건이 조정될 수 있습니다. 자문이 필요하면 {link}에서 신청할 수 있습니다.",
  hintLink: {
    url: "https://legal.lgresearch.ai/#/app/law/save",
    label: "법무팀 자문 시스템",
  },
  hintWhen: "확인 필요",
  hintTone: "amber",
};

const dataPurchase: FormSchema = {
  type: "data_purchase",
  label: "데이터 구매 신청",
  description: "외부 데이터셋을 일회성으로 구매할 때 (라이선스·예산 검토 동반)",
  projectField: "프로젝트명",
  sections: [
    {
      title: "기본 정보",
      fields: [
        {
          key: "프로젝트명",
          label: "프로젝트명",
          type: "text",
          placeholder: "PMS 기준 프로젝트명을 입력하세요",
          required: true,
        },
      ],
    },
    {
      title: "조직장 사전 승인",
      fields: [
        {
          key: "조직장_승인_완료",
          label: "조직장 승인 완료 — 조직장 사전 승인을 완료한 후 신청서를 제출해 주세요.",
          type: "checkbox",
          required: true,
        },
      ],
    },
    {
      title: "데이터 정보",
      fields: [
        {
          key: "구매_희망_데이터셋",
          label: "구매 희망 데이터셋",
          type: "text",
          placeholder: "데이터셋명 또는 상세 설명",
          required: true,
        },
        { key: "사용_시작일", label: "사용 시작일", type: "date", required: true },
        { key: "사용_종료일", label: "사용 종료일", type: "date", required: true },
        {
          key: "판매_업체",
          label: "판매 업체",
          type: "text",
          placeholder: "업체명 (예: AI허브, Scale AI 등)",
          required: true,
        },
        {
          key: "사용_예상_금액",
          label: "사용 예상 금액 (예산)",
          type: "text",
          placeholder: "예: KRW 5,000,000",
          required: true,
        },
      ],
    },
    {
      title: "사용 목적 및 활용 계획",
      fields: [
        {
          key: "사용_목적_및_기대_효과",
          label: "사용 목적/기대 효과",
          type: "textarea",
          placeholder: "사용 모델 및 서비스명을 포함해 작성해 주세요",
          required: true,
        },
        {
          key: "데이터_품질_검수_담당자",
          label: "데이터 품질/검수 담당자",
          type: "text",
          placeholder: "사내 담당자 이름·소속",
          required: true,
        },
        {
          key: "활용_가능_범위",
          label: "활용 가능 범위",
          type: "textarea",
          placeholder: "예: 사내 모델 학습 한정, 외부 공개 모델 제외",
          required: true,
        },
      ],
    },
    {
      title: "데이터셋에 대한 compliance 확인 여부",
      fields: [COMPLIANCE_FIELD],
    },
    {
      title: "기타",
      optional: true,
      fields: [
        {
          key: "기타_추가_내용",
          label: "추가 내용",
          type: "textarea",
          placeholder: "담당자가 알아야 할 추가 내용이 있다면 작성해 주세요",
        },
      ],
    },
  ],
};

const dataSubscription: FormSchema = {
  type: "data_subscription",
  label: "데이터 구독 신청",
  description: "정기적으로 갱신되는 데이터를 월/연 단위 구독할 때",
  projectField: "프로젝트명",
  sections: [
    {
      title: "기본 정보",
      fields: [
        {
          key: "프로젝트명",
          label: "프로젝트명",
          type: "text",
          placeholder: "PMS 기준 프로젝트명을 입력하세요",
          required: true,
        },
      ],
    },
    {
      title: "조직장 사전 승인",
      fields: [
        {
          key: "조직장_승인_완료",
          label: "조직장 승인 완료 — 조직장 사전 승인을 완료한 후 신청서를 제출해 주세요.",
          type: "checkbox",
          required: true,
        },
      ],
    },
    {
      title: "데이터 정보",
      fields: [
        {
          key: "구독_희망_데이터셋",
          label: "구독 희망 데이터셋",
          type: "text",
          placeholder: "데이터셋명 또는 상세 설명",
          required: true,
        },
        { key: "구독_시작일", label: "구독 시작일", type: "date", required: true },
        { key: "구독_종료일", label: "구독 종료일", type: "date", required: true },
        {
          key: "구독_업체",
          label: "구독 업체",
          type: "text",
          placeholder: "업체명",
          required: true,
        },
        {
          key: "월_사용_예상_금액",
          label: "월 사용 예상 금액",
          type: "text",
          placeholder: "예: KRW 300,000",
          required: true,
        },
      ],
    },
    {
      title: "사용 목적 및 활용 계획",
      fields: [
        {
          key: "사용_목적_및_기대_효과",
          label: "사용 목적/기대 효과",
          type: "textarea",
          placeholder: "사용 모델 및 서비스명을 포함해 작성해 주세요",
          required: true,
        },
        {
          key: "데이터_품질_검수_담당자",
          label: "데이터 품질/검수 담당자",
          type: "text",
          placeholder: "사내 담당자 이름·소속",
          required: true,
        },
        {
          key: "활용_가능_범위",
          label: "활용 가능 범위",
          type: "textarea",
          placeholder: "예: 사내 분석 도구에 통합, API 호출 inference용",
          required: true,
        },
      ],
    },
    {
      title: "데이터셋에 대한 compliance 확인 여부",
      fields: [COMPLIANCE_FIELD],
    },
    {
      title: "기타",
      optional: true,
      fields: [
        {
          key: "기타_추가_내용",
          label: "추가 내용",
          type: "textarea",
          placeholder: "담당자가 알아야 할 추가 내용이 있다면 작성해 주세요",
        },
      ],
    },
  ],
};

const productLogUsage: FormSchema = {
  type: "product_log_usage",
  label: "Product 로그 데이터 활용 신청",
  description: "사내 Product 의 클릭·세션·이벤트 로그를 분석·학습에 활용할 때",
  projectField: "프로젝트명",
  sections: [
    {
      title: "신청 정보",
      fields: [
        { key: "프로젝트명", label: "프로젝트명", type: "text", required: true },
        { key: "대상_product", label: "대상 product", type: "text", required: true },
        { key: "활용_로그_종류", label: "활용 로그 종류", type: "textarea", placeholder: "예: 클릭 이벤트, 세션 로그" },
        { key: "활용_기간", label: "활용 기간", type: "text" },
        { key: "활용_목적", label: "활용 목적", type: "textarea" },
        { key: "개인정보_포함_여부", label: "개인정보 포함 여부", type: "radio", options: ["미포함", "포함 (별도 검토 필요)"] },
      ],
    },
  ],
};

const dataProductionPlan: FormSchema = {
  type: "data_production_plan",
  label: "데이터 제작 계획서",
  description: "본 신청 전에 데이터 제작 일정·수량·방식을 사전 정리할 때",
  projectField: "프로젝트명",
  sections: [
    {
      title: "계획 정보",
      fields: [
        { key: "프로젝트명", label: "프로젝트명", type: "text", required: true },
        { key: "데이터셋_명", label: "데이터셋 명", type: "text" },
        { key: "제작_목표", label: "제작 목표", type: "textarea" },
        { key: "제작_방식", label: "제작 방식", type: "textarea" },
        { key: "예상_수량", label: "예상 수량", type: "text" },
        { key: "착수일", label: "착수일", type: "date" },
        { key: "완료_예정일", label: "완료 예정일", type: "date" },
      ],
    },
  ],
};

// API 활용 계획서 — 외부 API/SaaS 사용 품의용
const apiUsagePlan: FormSchema = {
  type: "api_usage_plan",
  label: "API 활용 계획서",
  description: "외부 API 도입 전 사용 목적 · 기간 · 비용을 사전 품의할 때",
  projectField: "관련_프로젝트",
  sections: [
    {
      title: "신청 정보",
      fields: [
        {
          key: "관련_프로젝트",
          label: "항목 연관 프로젝트",
          type: "text",
          placeholder: "예: 2024 고객 행동 분석 플랫폼 구축",
          required: true,
        },
        {
          key: "API_사용_목적",
          label: "API 사용 목적",
          type: "textarea",
          placeholder: "예: LLM 기반 리포트 자동 생성 및 데이터 분석 워크플로우 효율화",
          required: true,
        },
        {
          key: "서비스_목록",
          label: "서비스명",
          type: "service_list",
          placeholder: "예: Claude API",
        },
        {
          key: "사용_기간",
          label: "사용 기간",
          type: "date_range",
        },
        {
          key: "결제_통화",
          label: "결제 통화",
          type: "currency",
        },
        {
          key: "총_예상_비용",
          label: "총 예상 비용",
          type: "amount_with_currency",
          currencyKey: "결제_통화",
          placeholder: "예: 5,000",
        },
      ],
    },
  ],
};

// 업무생산성 도구 신청 — 서비스 블록 동적 리스트 1개로 구성
const productivityTool: FormSchema = {
  type: "productivity_tool",
  label: "업무생산성 도구 신청",
  description: "팀 · 부서에서 사용할 SaaS 라이선스를 사용자 별로 신청할 때",
  // 서비스 블록 첫 항목의 service_name 을 project_name 으로 매핑
  // (FormBuilder.onSubmit 에서 array 타입을 특별 처리)
  projectField: "서비스_목록",
  sections: [
    {
      title: "신청 정보",
      fields: [
        { key: "서비스_목록", label: "", type: "service_blocks" },
      ],
    },
  ],
};

// 담당자 지정 — 신청서를 함께 봐야 하는 사람들. 7종 신청 양식 공통으로
// 마지막에 자동 부착되는 필수 섹션. 사용자가 이름을 한 명씩 Enter 로 추가.
// 내부 payload key 는 호환을 위해 '참조자' 유지 (라벨만 사용자 노출용).
const APPROVER_SECTION: SectionDef = {
  title: "담당자 지정",
  fields: [
    {
      key: "참조자",
      label: "담당자 지정",
      type: "approver_list",
      placeholder: "담당자 이름 입력 후 Enter (예: 홍길동)",
      required: true,
    },
  ],
};

function withApproverSection(schema: FormSchema): FormSchema {
  return { ...schema, sections: [...schema.sections, APPROVER_SECTION] };
}

export const FORM_SCHEMAS: Record<FormType, FormSchema> = {
  data_production: withApproverSection(dataProduction),
  data_purchase: withApproverSection(dataPurchase),
  data_subscription: withApproverSection(dataSubscription),
  product_log_usage: withApproverSection(productLogUsage),
  data_production_plan: withApproverSection(dataProductionPlan),
  api_usage_plan: withApproverSection(apiUsagePlan),
  productivity_tool: withApproverSection(productivityTool),
};
