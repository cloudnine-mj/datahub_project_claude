// 양식 미리보기 페이지 — 카탈로그에서 선택한 신청서 양식을 readOnly 로 노출.
//   ProcessStepper / Breadcrumb / 하단 액션 등 페이지 부속은 모두 제외하고 양식 본문만.
//   읽기 전용: 양식 컨테이너를 <fieldset disabled> + pointer-events-none 으로 감싸 입력 차단.

"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ApplicationFormSection } from "@/components/ApplicationForm/ApplicationFormSection";
import {
  ApiApplicationForm,
  newService,
  type ApiFormValues,
} from "@/components/api-form/ApiApplicationForm";
import { FORM_SCHEMAS } from "@/lib/formSchemas";
import type { FormType } from "@/lib/api";
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

      {/* 미리보기 헤더 */}
      <div className="mb-1 mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Eye size={14} aria-hidden="true" className="text-blue-700 dark:text-blue-300" />
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            양식 미리보기
          </span>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          실제 신청 페이지와 동일한 양식이 표시됩니다
        </p>
      </div>

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
  // 그 외 양식은 FORM_SCHEMAS 기반.
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
  const schema = FORM_SCHEMAS[formType];
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
        <div className="rounded-lg bg-gray-50 px-3.5 py-3 dark:bg-gray-800/40">
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
