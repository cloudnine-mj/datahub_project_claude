// '제출 전 검토' 모달 — 제출(create) / 수정(edit) 두 맥락으로 분기.
//   create: 입력 내용 최종 확인 후 신청서 제출.
//   edit:   원본 대비 변경 항목 요약 + 변경 행 강조 + '수정 제출'.
//
// 모든 신청 유형(service / purchase / subscribe) 에서 스키마의 데이터 필드 전체 노출.
// checkbox 액션성 항목(조직장 승인 등) / attachment(sessionStorage 영속) 는 제외.

"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, Info, Paperclip, Pencil, X } from "lucide-react";
import {
  APPLICATION_TYPE_LABEL,
  APPLICATION_TO_FORM_TYPE,
  type ApplicationType,
} from "@/lib/governance/forms/application-config";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/governance/forms/schemas";
import {
  readStoredAttachments,
  type StoredAttachment,
} from "./InlineAttachmentInput";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface RowDef {
  key: string;
  label: string;
}

interface ChangeItem {
  key: string;
  label: string;
  before: string;
  after: string;
}

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
  /** 'create'(기본) | 'edit'. edit 면 수정 맥락(변경 요약 / 수정 제출)으로 분기. */
  mode?: "create" | "edit";
  /** 수정 진입 시점 원본 값 — edit 모드에서 변경 항목 비교에 사용. */
  originalPayload?: Record<string, unknown>;
  /** 임시저장 후 폼 id. 첨부는 payload 가 아니라 sessionStorage 에 영속되므로
   *  formId(없으면 임시 키)로 첨부 목록을 읽어 미리보기에 함께 표시한다. */
  formId?: string | null;
}

export function PreSubmitPreviewModal({
  type,
  payload,
  applicantName,
  applicantDepartment,
  onClose,
  onConfirmSubmit,
  mode = "create",
  originalPayload,
  formId = null,
}: Props) {
  const isEdit = mode === "edit";
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
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

  const rows: RowDef[] = useMemo(() => {
    const all: RowDef[] = [];
    schema.sections.forEach((sec) => {
      sec.fields.forEach((f: FieldDef) => {
        if (f.type === "checkbox" || f.type === "attachment") return;
        all.push({ key: f.key, label: f.label });
      });
    });
    return all;
  }, [schema]);

  // 첨부파일 — payload 가 아닌 sessionStorage 에 영속되므로 formId(또는 임시 키)로 읽는다.
  //   스키마에 attachment 필드가 있는 유형(용역 제작 등)에서만 행을 노출.
  const hasAttachmentField = useMemo(
    () =>
      schema.sections.some((sec) =>
        sec.fields.some((f) => f.type === "attachment"),
      ),
    [schema],
  );
  const attachments: StoredAttachment[] = useMemo(
    () => (hasAttachmentField ? readStoredAttachments(formId, type) : []),
    [hasAttachmentField, formId, type],
  );

  // edit 모드 — 원본 대비 변경된 필드만 수집 (es5 호환: forEach).
  const changes: ChangeItem[] = useMemo(() => {
    if (!isEdit || !originalPayload) return [];
    const out: ChangeItem[] = [];
    rows.forEach((r) => {
      const before = formatValue(originalPayload[r.key]);
      const after = formatValue(payload[r.key]);
      if (before !== after) {
        out.push({ key: r.key, label: r.label, before, after });
      }
    });
    return out;
  }, [isEdit, originalPayload, payload, rows]);

  const changedKeys = useMemo(
    () => new Set(changes.map((c) => c.key)),
    [changes],
  );

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
            <div className="flex items-center gap-2">
              <h2
                id="pre-submit-title"
                className="text-[17px] font-medium text-gray-900 dark:text-gray-100"
              >
                제출 전 검토
              </h2>
              {isEdit && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: "#FAEEDA", color: "#854F0B" }}
                >
                  <Pencil size={11} aria-hidden="true" /> 수정 제출
                </span>
              )}
            </div>
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
            {isEdit
              ? "변경한 내용을 확인한 뒤 다시 제출하세요."
              : `입력한 내용을 확인한 뒤 제출하세요. (${APPLICATION_TYPE_LABEL[type]} 신청)`}
          </p>
        </header>

        {/* 본문 — 세로 스크롤 */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {/* edit 모드 — 변경 항목 요약 블록 */}
          {isEdit && (
            <div
              className="mb-5 rounded-md px-4 py-3.5"
              style={{ background: "#FAEEDA" }}
            >
              {changes.length === 0 ? (
                <p className="text-[12px]" style={{ color: "#854F0B" }}>
                  변경된 내용이 없습니다.
                </p>
              ) : (
                <>
                  <p
                    className="mb-2 text-[12px] font-medium"
                    style={{ color: "#854F0B" }}
                  >
                    변경된 항목 {changes.length}건
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {changes.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-baseline gap-2 text-[12px]"
                      >
                        <span className="w-[140px] shrink-0 text-gray-500">
                          {c.label}
                        </span>
                        <span className="text-gray-400 line-through">
                          {c.before}
                        </span>
                        <ArrowRight
                          size={12}
                          aria-hidden="true"
                          className="shrink-0 text-gray-400"
                        />
                        <span className="font-medium" style={{ color: "#854F0B" }}>
                          {c.after}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <h3 className="mb-[14px] text-[15px] font-medium text-gray-900 dark:text-gray-100">
            {schema.label}
            {projectName && (
              <span className="text-gray-500 dark:text-gray-400"> — {projectName}</span>
            )}
          </h3>

          {/* 미리보기 표 — 바깥 테두리 + radius + overflow hidden (행은 내부 구분선 유지). */}
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                <PreviewRow label="신청자" value={applicant} />
                {rows.map((r, idx) => {
                  const text = formatValue(payload[r.key]);
                  const isLast =
                    idx === rows.length - 1 && !hasAttachmentField;
                  return (
                    <PreviewRow
                      key={r.key}
                      label={r.label}
                      value={text}
                      noBorder={isLast}
                      changed={isEdit && changedKeys.has(r.key)}
                    />
                  );
                })}
                {hasAttachmentField && (
                  <AttachmentRow attachments={attachments} />
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* sticky 푸터 — info 안내 + 액션 버튼 */}
        <footer className="sticky bottom-0 rounded-b-xl border-t border-gray-100 bg-white px-7 py-4 dark:border-gray-800 dark:bg-gray-900">
          {isEdit ? (
            <div
              className="mb-3 flex items-start gap-2 rounded-md px-3 py-2.5 text-[12px]"
              style={{ background: "#E6F1FB", color: "#0C447C" }}
            >
              <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                다시 제출하면 담당자에게 수정 사실이 전달되고, 진행 이력에{" "}
                <strong className="font-semibold">신청서 수정</strong>으로 기록됩니다.
              </p>
            </div>
          ) : (
            <div className="mb-3 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-[12px] text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                제출하면 신청서가 <strong className="font-semibold">거버넌스 요청 목록</strong>으로 이동하며, 담당자 검토가 시작됩니다.
                진행 상황은 거버넌스 요청 목록에서 확인할 수 있습니다.
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              닫기
            </button>
            {isEdit ? (
              <button
                ref={submitButtonRef}
                type="button"
                onClick={onConfirmSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2 text-[13px] font-medium text-white transition hover:brightness-110"
                style={{ background: "#BA7517" }}
              >
                <Pencil size={14} aria-hidden="true" /> 수정 제출
              </button>
            ) : (
              <button
                ref={submitButtonRef}
                type="button"
                onClick={onConfirmSubmit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-5 py-2 text-[13px] font-medium text-red-700 transition hover:brightness-95 dark:bg-red-900/30 dark:text-red-300"
              >
                신청서 제출
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
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
  changed,
}: {
  label: string;
  value: string;
  noBorder?: boolean;
  changed?: boolean;
}) {
  const borderClass = noBorder
    ? ""
    : "border-b border-gray-200 dark:border-gray-800";
  return (
    <tr className={borderClass} style={changed ? { background: "#FCF8EF" } : undefined}>
      <th
        scope="row"
        className="w-[160px] bg-gray-50 px-[14px] py-[11px] text-left text-gray-500 font-normal dark:bg-gray-800/40 dark:text-gray-400"
      >
        {label}
      </th>
      <td className="px-[14px] py-[11px] text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
        {value}
        {changed && (
          <span className="ml-1.5 text-[11px]" style={{ color: "#854F0B" }}>
            (변경됨)
          </span>
        )}
      </td>
    </tr>
  );
}

/** 첨부파일 행 — 미리보기 표 마지막 행. 저장된 첨부의 파일명·크기를 나열.
 *  첨부가 없으면 '—' 표시. (다운로드는 새로고침 시 ObjectURL 이 사라지므로 미리보기에선 생략) */
function AttachmentRow({ attachments }: { attachments: StoredAttachment[] }) {
  return (
    <tr>
      <th
        scope="row"
        className="w-[160px] bg-gray-50 px-[14px] py-[11px] text-left align-top text-gray-500 font-normal dark:bg-gray-800/40 dark:text-gray-400"
      >
        첨부파일
      </th>
      <td className="px-[14px] py-[11px] text-gray-900 dark:text-gray-100">
        {attachments.length === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <Paperclip
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-gray-400"
                />
                <span className="min-w-0 break-all">{a.filename}</span>
                <span className="shrink-0 text-[11px] text-gray-400">
                  {formatBytes(a.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}
