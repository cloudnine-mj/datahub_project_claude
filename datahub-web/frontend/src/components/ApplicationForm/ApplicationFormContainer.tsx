// 신청서 작성 substep 메인 컨테이너 — status 에 따라 작성/추적 두 모드로 분기.
//   - 디자인은 커스텀 (빨간 막대 섹션 + 120px 라벨 + 유형 칩 + custom 액션 영역)
//   - 양식 필드는 FORM_SCHEMAS 를 단일 진실의 원천으로 사용 (이전 임의 config 폐기)
//   - draft: 안내 배너 + 양식 카드(신청자 정보 + 스키마 섹션들) + 작성 액션
//   - submitted/reviewing/approved: 큰 제목 + 진행 상태/이력 + 요약 + 추적 액션

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, FileText, Save } from "lucide-react";
import { FORM_SCHEMAS } from "@/lib/formSchemas";
import { ApplicationTypeChip } from "./ApplicationTypeChip";
import { ApplicationFormSection } from "./ApplicationFormSection";
import { ApplicationPreviewModal } from "./ApplicationPreviewModal";
import { StatusBanner } from "./StatusBanner";
import { ProgressStatusBlock } from "./ProgressStatusBlock";
import { ProgressHistoryBlock } from "./ProgressHistoryBlock";
import { SubmittedSummaryBlock } from "./SubmittedSummaryBlock";
import {
  APPLICATION_TO_FORM_TYPE,
  mockHistoryFor,
  type ApplicationStatus,
  type ApplicationType,
} from "@/lib/applicationFormConfig";

interface Props {
  type: ApplicationType;
  initialStatus: ApplicationStatus;
  /** 작성 모드 '계획 수립 다시 보기' 버튼 경로. */
  prevPath?: string;
  /** 다음 substep (전자결재 품의) 경로. */
  nextPath: string;
}

const PAGE_TITLE: Record<ApplicationType, string> = {
  service: "데이터 용역 제작 신청",
  purchase: "데이터 구매 신청",
  subscribe: "데이터 구독 신청",
};

const APPLICANT_INFO = {
  name: "김데이터",
  department: "AI Platform",
  email: "kim.data@lgresearch.ai",
};

export function ApplicationFormContainer({
  type,
  initialStatus,
  prevPath,
  nextPath,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const formType = APPLICATION_TO_FORM_TYPE[type];
  const schema = FORM_SCHEMAS[formType];
  const history = mockHistoryFor(status);

  const onChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const onPreview = () => setPreviewOpen(true);
  const onSaveDraft = () => console.log("[stub] 임시 저장", values);
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

          <form
            className="mt-5 space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <SubmitterReadOnlySection />
            {schema.sections.map((s, i) => (
              <ApplicationFormSection
                key={`${s.title}-${i}`}
                section={s}
                values={values}
                onChange={onChange}
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

        {previewOpen && (
          <ApplicationPreviewModal
            type={type}
            onClose={() => setPreviewOpen(false)}
          />
        )}
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
      <SubmittedSummaryBlock type={type} />

      <TrackingActions onCancel={onCancel} onProceedToApproval={onProceedToApproval} />
    </div>
  );
}

// --- 신청자 정보 (읽기 전용) ---

function SubmitterReadOnlySection() {
  return (
    <section>
      <header className="mb-4 flex items-center gap-2">
        <span aria-hidden="true" className="block h-4 w-[3px] rounded-sm bg-brand" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          신청자 정보
        </h3>
      </header>

      <div className="space-y-3.5">
        <ReadOnlyRow label="신청자 이름" value={APPLICANT_INFO.name} />
        <ReadOnlyRow label="소속" value={APPLICANT_INFO.department} />
        <ReadOnlyRow label="이메일" value={APPLICANT_INFO.email} />
      </div>
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="pt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <input
        type="text"
        value={value}
        readOnly
        disabled
        className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
      />
    </div>
  );
}

// --- 액션 영역 ---

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
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
        >
          신청서 제출
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function TrackingActions({
  onCancel,
  onProceedToApproval,
}: {
  onCancel: () => void;
  onProceedToApproval: () => void;
}) {
  return (
    <div className="mt-2 flex flex-col items-stretch justify-end gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        신청 취소
      </button>
      <button
        type="button"
        onClick={onProceedToApproval}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
      >
        전자결재 품의로
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function SecondaryButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: typeof Save;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
