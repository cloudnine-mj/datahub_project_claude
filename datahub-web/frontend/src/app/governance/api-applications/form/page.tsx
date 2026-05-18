// API 활용 계획서 · 1단계 기획 · 신청서 작성.
//   ApiProcessStepper (현재 phase 만 노출) + 양식 본문 + 하단 액션 4종.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ApiProcessStepper } from "@/components/ApiProcess/ApiProcessStepper";
import {
  ApiApplicationForm,
  newService,
  type ApiFormValues,
} from "@/components/api-form/ApiApplicationForm";

// 데모용 신청자 정보 — 실제는 /me API 에서 로드.
const APPLICANT = {
  name: "김데이터",
  department: "AI Platform",
  email: "kim.data@lge.com",
};

export default function Page() {
  const router = useRouter();
  const [values, setValues] = useState<ApiFormValues>({
    projectName: "",
    apiPurpose: "",
    services: [newService()],
    files: [],
  });
  const [toast, setToast] = useState<string | null>(null);

  const onSaveDraft = () => {
    // 데모: 실제 저장 없이 토스트만.
    setToast("임시 저장되었습니다.");
    setTimeout(() => setToast(null), 2000);
  };

  const onSubmit = () => {
    // 데모 검증: 필수 항목 비어있지 않은지.
    if (!values.projectName.trim() || !values.apiPurpose.trim()) {
      setToast("필수 항목을 모두 입력해 주세요.");
      setTimeout(() => setToast(null), 2000);
      return;
    }
    const incomplete = values.services.some(
      (s) =>
        !s.serviceName.trim() ||
        !s.startDate ||
        !s.endDate ||
        (s.estimatedCost ?? 0) <= 0,
    );
    if (incomplete) {
      setToast("모든 서비스의 필수 정보를 입력해 주세요.");
      setTimeout(() => setToast(null), 2000);
      return;
    }
    router.push("/governance/api-applications/approval");
  };

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "API 활용 계획서", href: "/governance/api-applications/planning" },
          { label: "1. 기획 · 신청서 작성" },
        ]}
      />

      <ApiProcessStepper currentSubstep="form" onlyCurrentPhase />

      <ApiApplicationForm applicant={APPLICANT} values={values} onChange={setValues} />

      {/* 하단 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/governance/api-applications/planning")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          계획 수립 다시 보기
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSaveDraft}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Save size={13} aria-hidden="true" />
            임시 저장
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark"
          >
            신청서 제출
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      {toast && (
        <div
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
