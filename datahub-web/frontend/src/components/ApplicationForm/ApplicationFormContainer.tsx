// 신청서 작성 substep 메인 컨테이너 — status 에 따라 작성/추적 두 모드로 분기.
//   draft: 안내 배너 + 양식 + 자동 저장 + 작성 액션
//   submitted/reviewing/approved: 큰 제목 + 진행 상태 + 진행 이력 + 제출 요약 + 추적 액션
//   양식은 추적 모드에서 노출되지 않음 — '전체 보기' 버튼으로 별도 조회.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, FileText, Save } from "lucide-react";
import { ApplicationTypeChip } from "./ApplicationTypeChip";
import { StatusBanner } from "./StatusBanner";
import { ProgressStatusBlock } from "./ProgressStatusBlock";
import { ProgressHistoryBlock } from "./ProgressHistoryBlock";
import { SubmittedSummaryBlock } from "./SubmittedSummaryBlock";
import { ApplicationFormSection } from "./ApplicationFormSection";
import {
  APPLICATION_FORM_CONFIG,
  APPLICATION_TYPE_LABEL,
  mockHistoryFor,
  type ApplicationStatus,
  type ApplicationType,
} from "@/lib/applicationFormConfig";

interface Props {
  type: ApplicationType;
  initialStatus: ApplicationStatus;
  /** 작성 모드에서 좌측 '계획 수립 다시 보기' 버튼 경로. */
  prevPath?: string;
  /** 다음 substep (전자결재 품의) 경로 — approved 일 때 활성. */
  nextPath: string;
}

const DEFAULT_VALUES: Record<string, string> = {
  applicant: "김데이터 (AI Platform)",
};

const PAGE_TITLE: Record<ApplicationType, string> = {
  service: "데이터 용역 제작 신청",
  purchase: "데이터 구매 신청",
  subscribe: "데이터 구독 신청",
};

export function ApplicationFormContainer({
  type,
  initialStatus,
  prevPath,
  nextPath,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [values, setValues] = useState<Record<string, string>>(DEFAULT_VALUES);

  const sections = APPLICATION_FORM_CONFIG[type];
  const history = mockHistoryFor(status);

  const onChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    console.log("[stub] auto-save field:", id);
  };

  const onSaveDraft = () => console.log("[stub] 임시 저장", values);
  const onPreview = () => console.log("[stub] 미리보기", values);

  const onSubmit = () => {
    console.log("[stub] 신청서 제출", values);
    setStatus("submitted");
  };

  const onCancel = () => {
    if (!window.confirm("신청을 취소하시겠습니까? 다시 작성 모드로 돌아갑니다.")) return;
    console.log("[stub] 신청 취소");
    setStatus("draft");
  };

  const onProceedToApproval = () => router.push(nextPath);

  if (status === "draft") {
    return (
      <>
        <StatusBanner status={status} />

        <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:px-6 sm:py-5">
          <header className="flex items-center gap-2">
            <FileText
              size={16}
              aria-hidden="true"
              className="text-gray-500 dark:text-gray-400"
            />
            <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
              신청서 작성
            </h2>
            <ApplicationTypeChip type={type} />
          </header>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            계획 수립 단계에서 정리한 내용을 입력하세요.
          </p>

          <form className="mt-5 space-y-6" onSubmit={(e) => e.preventDefault()}>
            {sections.map((s) => (
              <ApplicationFormSection
                key={s.id}
                section={s}
                values={values}
                onChange={onChange}
                disabled={false}
              />
            ))}
          </form>
        </section>

        <DraftActions
          prevPath={prevPath}
          onSaveDraft={onSaveDraft}
          onPreview={onPreview}
          onSubmit={onSubmit}
        />
      </>
    );
  }

  // tracking mode (submitted / reviewing / approved)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1">
        <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          {PAGE_TITLE[type]}
        </h2>
        <ApplicationTypeChip type={type} />
      </div>

      <ProgressStatusBlock status={status} history={history} />
      <ProgressHistoryBlock history={history} />
      <SubmittedSummaryBlock type={type} values={values} />

      <TrackingActions
        status={status}
        onCancel={onCancel}
        onProceedToApproval={onProceedToApproval}
      />
    </div>
  );
}

// --- actions ---

interface DraftActionsProps {
  prevPath?: string;
  onSaveDraft: () => void;
  onPreview: () => void;
  onSubmit: () => void;
}

function DraftActions({
  prevPath,
  onSaveDraft,
  onPreview,
  onSubmit,
}: DraftActionsProps) {
  return (
    <div className="mt-2 flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
      <div>
        {prevPath && (
          <Link
            href={prevPath}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            계획 수립 다시 보기
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={onPreview} icon={Eye} label="미리보기" />
        <SecondaryButton onClick={onSaveDraft} icon={Save} label="임시 저장" />
        <PrimaryButton onClick={onSubmit} label="신청서 제출" />
      </div>
    </div>
  );
}

interface TrackingActionsProps {
  status: ApplicationStatus;
  onCancel: () => void;
  onProceedToApproval: () => void;
}

function TrackingActions({
  status,
  onCancel,
  onProceedToApproval,
}: TrackingActionsProps) {
  // TODO: 원래 조건 — status === 'approved' 일 때만 활성. 데모 단계에서는 항상 활성으로 풀어둠.
  void status;

  return (
    <div className="mt-2 flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
      <SecondaryButton onClick={onCancel} label="신청 취소" />
      <PrimaryButton onClick={onProceedToApproval} label="전자결재 품의로" />
    </div>
  );
}

function SecondaryButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon?: typeof Save;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
      {label}
    </button>
  );
}

function PrimaryButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
    >
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </button>
  );
}
