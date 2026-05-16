// 신청서 작성 substep 메인 컨테이너 — status 에 따라 작성/추적 두 모드로 분기.
//   draft: 안내 배너 + FormBuilder embed (실제 FORM_SCHEMAS 양식) + 좌측 prev 링크
//   submitted/reviewing/approved: 큰 제목 + 진행 상태 + 진행 이력 + 제출 요약 + 추적 액션
//   양식 입력 자체는 FormBuilder 가 처리 — 자체 임시 저장 / 제출 버튼 사용.
//   데모용으로 status 전환은 query 로 받음 (?status=).

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FormBuilder } from "@/components/FormBuilder";
import { ApplicationTypeChip } from "./ApplicationTypeChip";
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
  /** 작성 모드에서 '계획 수립 다시 보기' 버튼 경로. */
  prevPath?: string;
  /** 다음 substep (전자결재 품의) 경로. */
  nextPath: string;
}

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
  const formType = APPLICATION_TO_FORM_TYPE[type];
  const history = mockHistoryFor(initialStatus);

  const onCancel = () => {
    if (!window.confirm("신청을 취소하시겠습니까? 다시 작성 모드로 돌아갑니다.")) return;
    console.log("[stub] 신청 취소");
    // 데모 모드 — query param 으로 draft 로 되돌리려면 url 조작 필요. 현재는 로그만.
  };

  const onProceedToApproval = () => router.push(nextPath);

  if (initialStatus === "draft") {
    return (
      <>
        <StatusBanner status={initialStatus} />

        {prevPath && (
          <div>
            <Link
              href={prevPath}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              계획 수립 다시 보기
            </Link>
          </div>
        )}

        <FormBuilder formType={formType} embedded />
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

      <ProgressStatusBlock status={initialStatus} history={history} />
      <ProgressHistoryBlock history={history} />
      <SubmittedSummaryBlock type={type} />

      <TrackingActions onCancel={onCancel} onProceedToApproval={onProceedToApproval} />
    </div>
  );
}

interface TrackingActionsProps {
  onCancel: () => void;
  onProceedToApproval: () => void;
}

function TrackingActions({ onCancel, onProceedToApproval }: TrackingActionsProps) {
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
