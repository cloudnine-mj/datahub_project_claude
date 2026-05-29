// 양식 미리보기 페이지 — 카탈로그에서 선택한 신청서 양식을 readOnly 로 노출.
//   ProcessStepper / Breadcrumb / 하단 액션 등 페이지 부속은 모두 제외하고 양식 본문만.
//   읽기 전용: 양식 컨테이너를 <fieldset disabled> + pointer-events-none 으로 감싸 입력 차단.

"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { ApplicationFormSection } from "@/components/governance/ApplicationForm/ApplicationFormSection";
import {
  ApiApplicationForm,
  newService,
  type ApiFormValues,
} from "@/components/governance/api-form/ApiApplicationForm";
import { FORM_SCHEMAS, type FormSchema } from "@/lib/governance/forms/schemas";
import type { FormType } from "@/lib/governance/api-client-full";

// 카탈로그는 '표준 원본 양식' 참조용 — 작성 화면의 UX 개편(조직장 승인 row 이동,
// 첨부파일 row 추가) 이전 형태를 그대로 노출. FORM_SCHEMAS 와 분리해 작성 화면
// 변경이 카탈로그에 자동 반영되지 않도록 함.
const CATALOG_DATA_PRODUCTION: FormSchema = {
  type: "data_production",
  label: "데이터 용역 제작 신청",
  description: "외주 업체에 데이터 라벨링·수집·검수 작업을 의뢰할 때",
  projectField: "관련_프로젝트_PMS",
  sections: [
    {
      title: "조직장 사전 승인",
      layout: "table",
      fields: [
        {
          key: "조직장_승인_완료",
          label: "조직장 승인 완료 — 조직장 사전 승인을 완료한 후 신청서를 제출해 주세요.",
          tableLabel: "조직장 승인",
          type: "checkbox",
          required: true,
        },
      ],
    },
    {
      title: "요청 정보",
      layout: "table",
      fields: [
        { key: "관련_프로젝트_PMS", label: "관련 프로젝트 (PMS 기준)", type: "text", placeholder: "데이터셋이 활용되는 프로젝트명을 기재해 주세요 (복수 기재 가능)", required: true },
        { key: "데이터셋_활용_목적", label: "데이터셋 활용 목적", type: "textarea", placeholder: "데이터셋을 활용하는 목적을 기재해 주세요 (서비스 기능 평가)", rows: 2 },
        { key: "데이터셋_이름", label: "데이터셋 이름", type: "text", placeholder: "K-Nowledge" },
        { key: "희망_작업_착수일", label: "작업 착수 희망일", type: "date", inlineNote: "신청서 제출 기준 3주 이후부터 선택 가능" },
        { key: "희망_수령일", label: "데이터 수령 희망일", type: "date", inlineNote: "작업 마감 기한" },
        { key: "작업_형태", label: "작업 형태", type: "text", placeholder: "문항 풀기 및 문항의 문화 적합성 평가" },
        { key: "작업_도구", label: "작업 도구", type: "text", placeholder: "엑셀" },
        { key: "목표_데이터_수량", label: "목표 데이터 수량", type: "number", placeholder: "숫자만 입력" },
        { key: "목표_데이터_수량_단위상세", label: "목표 데이터 수량 (단위 상세)", type: "textarea", placeholder: "예: Seed Q: 500개 / Following Q 8지선다 선택: 2500건 / AB test: 500건" },
        { key: "데이터_1개당_필요_작업자", label: "데이터 1개당 필요 작업자", type: "text", placeholder: "3명 이상" },
        { key: "작업자_보유_기술", label: "작업자 보유 기술", type: "text", placeholder: "예: 영어모어화자, 특정 자격증, 도메인 지식 등" },
        { key: "품질_평가_방식", label: "품질 평가 방식", type: "text", placeholder: "품질 평가 방식을 기재해 주세요" },
      ],
    },
  ],
};

const CATALOG_SCHEMA_OVERRIDES: Partial<Record<FormType, FormSchema>> = {
  data_production: CATALOG_DATA_PRODUCTION,
};
import { FormBuilder } from "@/components/governance/FormBuilder";
import { getCatalogEntry, type CatalogEntry } from "../catalog-config";

const PREVIEW_APPLICANT = {
  name: "김데이터",
  department: "AI Platform",
  email: "kim.data@lge.com",
};

export default function Page({ params }: { params: { formId: string } }) {
  const router = useRouter();
  const entry = getCatalogEntry(params.formId);
  if (!entry) {
    notFound();
  }

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "신청서 양식 카탈로그", href: "/governance/admin/forms-catalog" },
          { label: entry.label },
        ]}
      />

      {/* 페이지 헤더 */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[18px] font-medium text-gray-900 dark:text-gray-100">
            {entry.label}
          </h1>
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
            {entry.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/governance/admin/forms-catalog")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          카탈로그로 돌아가기
        </button>
      </header>

      {/* 양식 본문 — 관리자 미리보기이므로 편집 가능 */}
      <FormRenderer entry={entry} />
    </div>
  );
}

/** formId 에 따라 적절한 양식 본문 컴포넌트로 분기. */
function FormRenderer({ entry }: { entry: CatalogEntry }) {
  if (entry.id === "api_usage_plan") {
    return <ApiFormPreview />;
  }
  // 복합 필드(service_blocks 등) 가 있는 양식은 FormBuilder 풀 렌더링.
  // ApplicationFormSection 은 단순 타입만 처리하므로 textarea fallback 으로 양식이 짤려 보임.
  if (entry.id === "productivity_tool") {
    const schema = FORM_SCHEMAS["productivity_tool"];
    return (
      <section className="rounded-xl border border-gray-200 bg-white px-6 py-5 dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-4 border-b border-gray-200 pb-3.5 dark:border-gray-800">
          <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
            {schema.label}
          </h2>
          {schema.description && (
            <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
              {schema.description}
            </p>
          )}
        </header>
        <FormBuilder formType={entry.id as FormType} embedded />
      </section>
    );
  }
  // 그 외 양식은 FORM_SCHEMAS 기반 단순 미리보기.
  return <SchemaFormPreview formType={entry.id as FormType} />;
}

function ApiFormPreview() {
  const [values] = useState<ApiFormValues>({
    projectName: "",
    apiPurpose: "",
    services: [newService()],
    files: [],
  });
  return (
    <ApiApplicationForm
      applicant={PREVIEW_APPLICANT}
      values={values}
      onChange={() => {}}
    />
  );
}

function SchemaFormPreview({ formType }: { formType: FormType }) {
  const schema = CATALOG_SCHEMA_OVERRIDES[formType] ?? FORM_SCHEMAS[formType];
  const [values, setValues] = useState<Record<string, unknown>>({});
  const onChange = (key: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  if (!schema) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-6 py-5 dark:border-gray-800 dark:bg-gray-900">
      {/* 양식 헤더 */}
      <header className="mb-4 border-b border-gray-200 pb-3.5 dark:border-gray-800">
        <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
          {schema.label}
        </h2>
        {schema.description && (
          <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">
            {schema.description}
          </p>
        )}
      </header>

      {/* 신청자 정보 */}
      <div className="mb-5">
        <div className="mb-3 flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3.5 w-[3px] rounded-[1px] bg-brand" />
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            신청자 정보
          </span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-700 dark:bg-gray-900">
          <dl
            className="grid gap-y-2 gap-x-3.5 text-[12px]"
            style={{ gridTemplateColumns: "120px 1fr" }}
          >
            <dt className="text-gray-500 dark:text-gray-400">이름</dt>
            <dd className="text-gray-900 dark:text-gray-100">{PREVIEW_APPLICANT.name}</dd>
            <dt className="text-gray-500 dark:text-gray-400">소속</dt>
            <dd className="text-gray-900 dark:text-gray-100">{PREVIEW_APPLICANT.department}</dd>
            <dt className="text-gray-500 dark:text-gray-400">이메일</dt>
            <dd className="text-gray-900 dark:text-gray-100">{PREVIEW_APPLICANT.email}</dd>
          </dl>
        </div>
      </div>

      {/* 스키마 섹션들 */}
      <div className="space-y-5">
        {schema.sections.map((s) => (
          <ApplicationFormSection
            key={s.title}
            section={s}
            values={values}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}
