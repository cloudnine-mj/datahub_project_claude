// 신청서 작성 substep 메인 컨테이너 — status 분기 + 양식 + 자동 저장 + 액션.
//   status 는 query 로 받은 초기값 + 사용자 액션(제출/취소) 으로 변경.
//   양식 입력은 로컬 state. 실제 저장 API 연동 전 console.log 로 stub.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, FileText, Save } from "lucide-react";
import { ApplicationTypeChip } from "./ApplicationTypeChip";
import { StatusBanner } from "./StatusBanner";
import { ProgressStatusBlock } from "./ProgressStatusBlock";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import { ApplicationFormSection } from "./ApplicationFormSection";
import {
  APPLICATION_FORM_CONFIG,
  mockHistoryFor,
  type ApplicationStatus,
  type ApplicationType,
} from "@/lib/applicationFormConfig";

interface Props {
  type: ApplicationType;
  initialStatus: ApplicationStatus;
  /** prev/next 라우트 — substep stepper 의 좌우 액션 버튼용. */
  prevPath?: string;
  nextPath: string;
}

const DEFAULT_VALUES: Record<string, string> = {
  applicant: "김데이터 (AI Platform)",
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
  const isLocked = status !== "draft";

  const onChange = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    // TODO: debounced 자동 저장 — 현재는 변경 시 콘솔 추적.
    console.log("[stub] auto-save field:", id);
  };

  const onSaveDraft = () => {
    console.log("[stub] 임시 저장", values);
  };

  const onPreview = () => {
    console.log("[stub] 미리보기", values);
  };

  const onSubmit = () => {
    console.log("[stub] 신청서 제출", values);
    setStatus("submitted");
  };

  const onCancel = () => {
    if (!window.confirm("신청을 취소하시겠습니까? 다시 작성 모드로 돌아갑니다.")) {
      return;
    }
    console.log("[stub] 신청 취소");
    setStatus("draft");
  };

  const onProceedToApproval = () => {
    router.push(nextPath);
  };

  return (
    <>
      <ProgressStatusBlock status={status} history={history} />
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
              disabled={isLocked}
            />
          ))}
        </form>
      </section>

      {status === "draft" && (
        <div className="flex justify-center">
          <AutoSaveIndicator />
        </div>
      )}

      <FormActions
        status={status}
        prevPath={prevPath}
        onSaveDraft={onSaveDraft}
        onPreview={onPreview}
        onSubmit={onSubmit}
        onCancel={onCancel}
        onProceedToApproval={onProceedToApproval}
      />
    </>
  );
}

interface FormActionsProps {
  status: ApplicationStatus;
  prevPath?: string;
  onSaveDraft: () => void;
  onPreview: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onProceedToApproval: () => void;
}

function FormActions({
  status,
  prevPath,
  onSaveDraft,
  onPreview,
  onSubmit,
  onCancel,
  onProceedToApproval,
}: FormActionsProps) {
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
        {status === "draft" && (
          <>
            <SecondaryButton onClick={onPreview} icon={Eye} label="미리보기" />
            <SecondaryButton onClick={onSaveDraft} icon={Save} label="임시 저장" />
            <PrimaryButton onClick={onSubmit} label="신청서 제출" trailingIcon={ArrowRight} />
          </>
        )}
        {(status === "submitted" || status === "reviewing") && (
          <SecondaryButton onClick={onCancel} label="신청 취소" />
        )}
        {status === "approved" && (
          <PrimaryButton
            onClick={onProceedToApproval}
            label="전자결재 품의로"
            trailingIcon={ArrowRight}
          />
        )}
      </div>
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
  trailingIcon: TrailingIcon,
}: {
  onClick: () => void;
  label: string;
  trailingIcon?: typeof ArrowRight;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
    >
      {label}
      {TrailingIcon && <TrailingIcon size={14} aria-hidden="true" />}
    </button>
  );
}
