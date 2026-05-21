// 작성 모드의 '제출 전 검토' 모달 — draft 사용자가 신청서 제출 직전 입력 내용을 표로 최종 확인.
//   복사 기능 없음 (양식이 화면에 그대로 있어 복사가 의미 없음).
//
// 유형별 행 구성:
//   - service:           스키마의 모든 데이터 필드 자동 노출 (checkbox 액션성 항목 제외)
//   - purchase/subscribe: 기존 4–5 개 핵심 필드 (요청 범위 외)
//
// 레이아웃: 모달 max-h 85vh + flex column. 헤더·푸터 sticky, 본문 영역만 세로 스크롤.
// 푸터에 info 안내 박스 노출 — 제출 후 거버넌스 요청 목록으로 이동한다는 안내.

"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, Info, X } from "lucide-react";
import {
  APPLICATION_TYPE_LABEL,
  APPLICATION_TO_FORM_TYPE,
  type ApplicationType,
} from "@/lib/governance/forms/application-config";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/governance/forms/schemas";

interface RowDef {
  key: string;
  label: string;
}

/** purchase / subscribe 의 핵심 4–5 필드 (요청 범위 외 — 기존 동작 유지). */
const PRESUBMIT_ROWS_SHORT: Record<Exclude<ApplicationType, "service">, RowDef[]> = {
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

  // service 는 스키마의 모든 데이터 필드 자동 노출. purchase/subscribe 는 기존 핵심 행.
  const rows: RowDef[] = useMemo(() => {
    if (type === "service") {
      const all: RowDef[] = [];
      schema.sections.forEach((sec) => {
        sec.fields.forEach((f: FieldDef) => {
          // checkbox 는 액션·동의 항목이라 검토 표에서 제외.
          if (f.type === "checkbox") return;
          all.push({ key: f.key, label: f.label });
        });
      });
      return all;
    }
    return PRESUBMIT_ROWS_SHORT[type];
  }, [type, schema]);

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
        className="flex w-full max-w-[640px] max-h-[85vh] flex-col rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* sticky 헤더 */}
        <header className="sticky top-0 z-10 rounded-t-xl border-b border-gray-100 bg-white px-7 pb-4 pt-6 dark:border-gray-800 dark:bg-gray-900">
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
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            입력한 내용을 확인한 뒤 제출하세요. ({APPLICATION_TYPE_LABEL[type]} 신청)
          </p>
        </header>

        {/* 본문 — 세로 스크롤 */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          <h3 className="mb-[14px] text-[15px] font-medium text-gray-900 dark:text-gray-100">
            {schema.label}
            {projectName && (
              <span className="text-gray-500 dark:text-gray-400"> — {projectName}</span>
            )}
          </h3>

          <table className="w-full border-collapse text-[13px]">
            <tbody>
              <PreviewRow label="신청자" value={applicant} />
              {rows.map((r, idx) => {
                const v = payload[r.key];
                const text = formatValue(v);
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
        </div>

        {/* sticky 푸터 — info 안내 + 액션 버튼 */}
        <footer className="sticky bottom-0 rounded-b-xl border-t border-gray-100 bg-white px-7 py-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-[12px] text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
            <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p className="leading-relaxed">
              제출하면 신청서가 <strong className="font-semibold">거버넌스 요청 목록</strong>으로 이동하며, 담당자 검토가 시작됩니다.
              진행 상황은 요청 목록에서 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
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
        </footer>
      </div>
    </div>
  );
}

/** payload 값을 표시 문자열로 변환. 빈 값은 '—'. */
function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v.trim() || "—";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const arr = v.filter((x) => x != null && x !== "");
    return arr.length === 0 ? "—" : arr.map((x) => String(x)).join(", ");
  }
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "—";
    }
  }
  return String(v);
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
        className="w-[160px] bg-gray-50 px-[14px] py-[11px] text-left text-gray-500 font-normal dark:bg-gray-800/40 dark:text-gray-400"
      >
        {label}
      </th>
      <td className="px-[14px] py-[11px] text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
        {value}
      </td>
    </tr>
  );
}
