// 작성 모드의 '제출 전 검토' 모달 — draft 사용자가 신청서 제출 직전 입력 내용을 표로 최종 확인.
//   복사 기능 없음 (양식이 화면에 그대로 있어 복사가 의미 없음).
//   유형별 핵심 4~5 필드만 노출 (모달이 길어지지 않도록).
//   하단 액션: [닫기] [신청서 제출 →].

"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import {
  APPLICATION_TYPE_LABEL,
  APPLICATION_TO_FORM_TYPE,
  type ApplicationType,
} from "@/lib/applicationFormConfig";
import { FORM_SCHEMAS } from "@/lib/formSchemas";

interface RowDef {
  key: string;
  label: string;
}

/** 유형별 제출 전 검토에 노출할 핵심 필드 (4~5 개로 제한). */
const PRESUBMIT_ROWS: Record<ApplicationType, RowDef[]> = {
  subscribe: [
    { key: "프로젝트명", label: "프로젝트명" },
    { key: "구독_희망_데이터셋", label: "구독 희망 데이터셋" },
    { key: "구독_기간", label: "구독 기간" },
    { key: "월_사용_예상_금액", label: "월 사용 예상 금액" },
  ],
  purchase: [
    { key: "프로젝트명", label: "프로젝트명" },
    { key: "구매_희망_데이터셋", label: "구매 대상 데이터" },
    { key: "판매_업체", label: "구매 업체" },
    { key: "사용_예상_금액", label: "예상 비용" },
  ],
  service: [
    { key: "관련_프로젝트_PMS", label: "프로젝트명" },
    { key: "데이터셋_이름", label: "데이터명" },
    { key: "목표_데이터_수량", label: "제작 수량" },
    { key: "희망_수령일", label: "희망 수령일" },
  ],
};

const PROJECT_KEY: Record<ApplicationType, string> = {
  subscribe: "프로젝트명",
  purchase: "프로젝트명",
  service: "관련_프로젝트_PMS",
};

interface Props {
  type: ApplicationType;
  payload: Record<string, unknown>;
  applicantName: string;
  applicantDepartment: string;
  onClose: () => void;
  onConfirmSubmit: () => void;
}

export function PreSubmitPreviewModal({
  type,
  payload,
  applicantName,
  applicantDepartment,
  onClose,
  onConfirmSubmit,
}: Props) {
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    // 즉시 Enter 로 제출 확정할 수 있도록 [신청서 제출] 에 포커스.
    submitButtonRef.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const schema = FORM_SCHEMAS[APPLICATION_TO_FORM_TYPE[type]];
  const rows = PRESUBMIT_ROWS[type];
  const projectName = String(payload[PROJECT_KEY[type]] ?? "").trim();

  const applicant = applicantDepartment
    ? `${applicantName} (${applicantDepartment})`
    : applicantName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-submit-title"
    >
      <div
        className="w-full max-w-[640px] rounded-xl bg-white px-7 pt-6 pb-5 shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2
            id="pre-submit-title"
            className="text-[17px] font-medium text-gray-900 dark:text-gray-100"
          >
            제출 전 검토
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="mb-[18px] text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          입력한 내용을 확인한 뒤 제출하세요. ({APPLICATION_TYPE_LABEL[type]} 신청)
        </p>

        <h3 className="mb-[14px] text-[15px] font-medium text-gray-900 dark:text-gray-100">
          {schema.label}
          {projectName && <span className="text-gray-500 dark:text-gray-400"> — {projectName}</span>}
        </h3>

        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <PreviewRow label="신청자" value={applicant} />
            {rows.map((r, idx) => {
              const v = payload[r.key];
              const text =
                v == null || v === "" ? "—" : typeof v === "string" ? v : String(v);
              const isLast = idx === rows.length - 1;
              return (
                <PreviewRow
                  key={r.key}
                  label={r.label}
                  value={text}
                  noBorder={isLast}
                />
              );
            })}
          </tbody>
        </table>

        <div className="mt-[18px] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            닫기
          </button>
          <button
            ref={submitButtonRef}
            type="button"
            onClick={onConfirmSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-5 py-2 text-[13px] font-medium text-red-700 transition hover:brightness-95 dark:bg-red-900/30 dark:text-red-300"
          >
            신청서 제출
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  noBorder,
}: {
  label: string;
  value: string;
  noBorder?: boolean;
}) {
  const borderClass = noBorder
    ? ""
    : "border-b border-gray-200 dark:border-gray-800";
  return (
    <tr className={borderClass}>
      <th
        scope="row"
        className="w-[140px] bg-gray-50 px-[14px] py-[11px] text-left text-gray-500 font-normal dark:bg-gray-800/40 dark:text-gray-400"
      >
        {label}
      </th>
      <td className="px-[14px] py-[11px] text-gray-900 dark:text-gray-100">
        {value}
      </td>
    </tr>
  );
}
