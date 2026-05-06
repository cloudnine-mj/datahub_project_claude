/**
 * 신청서 5종의 필드 스키마 — 화면 9/10 의 폼 구조를 데이터화.
 *
 * 폼 자동 렌더링 + 백엔드 payload(JSON) 매핑에 사용. 새 신청서 추가 시 여기만 수정하면
 * 작성/상세 양쪽이 자동 반영된다.
 */

import type { FormType } from "./api";

export type FieldType = "text" | "textarea" | "date" | "number" | "select" | "radio" | "checkbox";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  hint?: string;
  /**
   * true 면 다음 필드를 같은 행(행 1개)에 인라인으로 함께 렌더링.
   * 다음 필드의 label 이 두 입력 사이에 인라인 레이블로 배치됨.
   * 예: 목표 데이터 수량(number) → 단위(text) 를 한 줄에.
   */
  inlineWithNext?: boolean;
}

/**
 * 데이터셋 저장 레포지토리 — 신청서에서 선택 가능한 사전 정의 목록.
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

// 화면 10 — 데이터 용역 제작 신청서
const dataProduction: FormSchema = {
  type: "data_production",
  label: "데이터 용역 제작 신청서",
  description: "외주 업체에 데이터 라벨링·수집·QA 등을 의뢰할 때 사용합니다. 작업 형태·수량·일정을 명시하세요.",
  projectField: "관련_프로젝트_PMS",
  sections: [
    {
      title: "요청 정보",
      fields: [
        { key: "관련_프로젝트_PMS", label: "관련 프로젝트 (PMS 기준)", type: "text", placeholder: "데이터셋이 활용되는 프로젝트명을 기재해 주세요 (복수 기재 가능, PMS 기준)", required: true },
        { key: "데이터셋_활용_목적", label: "데이터셋 활용 목적", type: "textarea", placeholder: "데이터셋을 활용하는 목적을 기재해 주세요 (서비스 기능 평가)" },
        { key: "데이터셋_이름", label: "데이터셋 이름", type: "text", placeholder: "멋진 이름을 정해 주세요!" },
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
        { key: "작업_형태", label: "작업 형태", type: "text", placeholder: "e.g., 대화, 점수 매기기, AB 테스트, 다차원 레이블링, 한영번역검수, OCR, 문서 수집, 문서QA" },
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
      title: "파일 첨부 체크 리스트",
      fields: [
        { key: "체크_샘플_데이터", label: "다양성이 있는 샘플 데이터를 직접 제작하여 최소 5개 보내주세요. (작업자 분들의 이해도가 올라가 데이터의 품질이 향상됩니다.)", type: "checkbox" },
        { key: "체크_가이드라인", label: "작업자 분들에게 전달할 작업 가이드라인을 보내주세요. 데이터 팀에 요청할 별도 사항이 있으시면 별도의 파일을 첨부해 주세요.", type: "checkbox" },
        { key: "체크_PoC_입력", label: "입력 데이터 / 소스 데이터가 필요한 작업일 경우 PoC 작업 용으로 소량 우선 제공해 주세요.", type: "checkbox" },
      ],
    },
  ],
};

// 화면 9 — 데이터 구매 신청서
const dataPurchase: FormSchema = {
  type: "data_purchase",
  label: "데이터 구매 신청서",
  description: "외부 데이터셋을 일회성으로 구매할 때 사용합니다. 판매처·예산·라이선스 검토가 필요합니다.",
  projectField: "프로젝트명",
  sections: [
    {
      title: "신청 정보",
      fields: [
        { key: "프로젝트명", label: "프로젝트명", type: "text", required: true },
        { key: "구매_희망_데이터셋", label: "구매 희망 데이터셋", type: "text", required: true },
        { key: "판매_업체", label: "판매 업체", type: "text" },
        { key: "사용_예상_금액", label: "사용 예상 금액 (예산)", type: "text", placeholder: "예: 5,000,000원" },
        { key: "사용_목적_및_기대_효과", label: "사용 목적 및 기대 효과", type: "textarea" },
        { key: "데이터_품질_검수_담당자", label: "데이터 품질/검수 담당자", type: "text" },
        {
          key: "compliance_확인_여부",
          label: "Compliance 확인 여부",
          type: "radio",
          options: ["확인 완료", "확인 필요"],
          hint: "라이선스·개인정보·외부 공유 가능 여부를 사전 검토했는지 확인. 미확인 시 컴플라이언스팀(compliance@example.com)에 문의 후 진행하세요.",
        },
        {
          key: "데이터셋_저장_레포지토리",
          label: "데이터셋 저장 레포지토리",
          type: "select",
          options: DATASET_REPOSITORIES,
        },
      ],
    },
  ],
};

const dataSubscription: FormSchema = {
  type: "data_subscription",
  label: "데이터 구독 신청서",
  description: "정기적으로 갱신되는 데이터를 구독할 때 사용합니다. 구독 기간·월 사용 비용을 명시하세요.",
  projectField: "프로젝트명",
  sections: [
    {
      title: "신청 정보",
      fields: [
        { key: "프로젝트명", label: "프로젝트명", type: "text", required: true },
        { key: "구독_희망_데이터셋", label: "구독 희망 데이터셋", type: "text", required: true },
        { key: "구독_업체", label: "구독 업체", type: "text" },
        { key: "구독_기간", label: "구독 기간", type: "text", placeholder: "예: 12개월" },
        { key: "월_사용_예상_금액", label: "월 사용 예상 금액", type: "text" },
        { key: "사용_목적", label: "사용 목적", type: "textarea" },
      ],
    },
  ],
};

const productLogUsage: FormSchema = {
  type: "product_log_usage",
  label: "product 로그 데이터 활용 신청서",
  description: "사내 프로덕트의 클릭·세션·이벤트 로그를 활용할 때 필요합니다. PII 검토가 동반됩니다.",
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
  description: "용역 신청 전 제작 일정·수량·방식을 정리하는 계획서입니다. 본 신청 전에 사전 검토용으로 활용.",
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

export const FORM_SCHEMAS: Record<FormType, FormSchema> = {
  data_production: dataProduction,
  data_purchase: dataPurchase,
  data_subscription: dataSubscription,
  product_log_usage: productLogUsage,
  data_production_plan: dataProductionPlan,
};
