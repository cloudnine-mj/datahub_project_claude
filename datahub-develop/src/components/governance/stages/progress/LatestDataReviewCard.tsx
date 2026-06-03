// 최신 데이터 검토 카드 — 진행 단계 60:40 좌측. 가장 최근 업로드된 파일을 보여주고,
//   납품 구분에 따라 다른 액션 버튼을 제공.
//     중간/수정 납품: [확인 완료] / [피드백 작성]
//     최종 납품:      [문제 없음 → 종료 절차] / [문제 있음 → 피드백 작성]

"use client";

import { AlertTriangle, CircleCheck, FileText, MessageSquare } from "lucide-react";
import {
  deliveryColors,
  deliveryShortLabel,
  fileTypeColor,
  fileTypeLabel,
  formatBytes,
  formatDateTime,
  type ReceivedDataItem,
} from "@/lib/governance/progress-storage";

interface Props {
  latest: ReceivedDataItem | null;
  /** [확인 완료] (중간/수정) — 부모가 status 갱신 + 진척 처리. */
  onConfirm: (item: ReceivedDataItem) => void;
  /** [피드백 작성] / [문제 있음] — 부모가 대상 자동 선택해 모달 오픈. */
  onRequestFeedback: (item: ReceivedDataItem) => void;
  /** [문제 없음 → 종료 절차] (최종) — 양식 모달 흐름(별도 작업). */
  onNoIssue: (item: ReceivedDataItem) => void;
}

export function LatestDataReviewCard({
  latest,
  onConfirm,
  onRequestFeedback,
  onNoIssue,
}: Props) {
  if (!latest) {
    return (
      <section className="rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[14px] py-[12px] dark:border-gray-700 dark:bg-gray-900">
        <header className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
          <h3 className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
            최신 데이터 검토
          </h3>
        </header>
        <div className="mt-3 flex flex-col items-center justify-center gap-1 px-3 py-5 text-center">
          <FileText size={20} aria-hidden="true" className="text-[var(--color-text-tertiary,#9ca3af)]" />
          <p className="text-[11px] text-[var(--color-text-secondary,#6b7280)]">
            아직 업로드된 데이터가 없습니다.
          </p>
        </div>
      </section>
    );
  }

  const dc = deliveryColors(latest.deliveryRound);
  const isFinal = latest.deliveryRound === "final";
  const headerBadge = isFinal
    ? `${deliveryShortLabel(latest.deliveryRound)} v${latest.version} 품질 확인 중`
    : `${deliveryShortLabel(latest.deliveryRound)} v${latest.version} 확인 대기`;

  function onDownload(): void {
    if (typeof window !== "undefined" && latest) {
      window.alert(`${latest.fileName} 다운로드 (Phase 1 mock)`);
    }
  }

  return (
    <section
      className="rounded-[10px] border-[0.5px] bg-white px-[14px] py-[12px] dark:bg-gray-900"
      style={{ borderColor: "#EFC4B9" }}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
          최신 데이터 검토
        </h3>
        <span
          className="inline-flex items-center text-[9px] font-medium"
          style={{ background: "#FAEEDA", color: "#854F0B", borderRadius: 4, padding: "2px 6px" }}
        >
          {headerBadge}
        </span>
      </header>

      <div
        className="rounded-md px-3 py-2"
        style={{ background: "var(--color-background-secondary,#f3f4f6)" }}
      >
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center text-[9px] font-medium"
            style={{ background: dc.bg, color: dc.text, borderRadius: 4, padding: "2px 6px" }}
          >
            {deliveryShortLabel(latest.deliveryRound)}
          </span>
          <span
            className="inline-flex items-center text-[9px] font-medium"
            style={{ background: "#D4533E", color: "#fff", borderRadius: 4, padding: "2px 6px" }}
          >
            v{latest.version}
          </span>
          <span
            className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[3px] text-[8px] font-medium text-white"
            style={{ background: fileTypeColor(latest.fileType) }}
            aria-hidden="true"
          >
            {fileTypeLabel(latest.fileType)}
          </span>
          <button
            type="button"
            onClick={onDownload}
            className="text-[11px] font-medium text-[#D4533E] hover:underline"
          >
            {latest.fileName}
          </button>
        </div>
        <div
          className="text-[10px] text-[var(--color-text-tertiary,#9ca3af)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatBytes(latest.fileSize)} · {latest.uploader} · {formatDateTime(latest.uploadedAt)}
        </div>
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="mb-2 text-[10px] font-medium text-[#D4533E]">
          {isFinal ? "품질 확인 결과 선택" : "다음 액션 선택"}
        </div>
        <div className="flex gap-2">
          {isFinal ? (
            <>
              <button
                type="button"
                onClick={() => onNoIssue(latest)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border-[0.5px] bg-transparent px-2 py-2 text-[11px] font-medium transition hover:bg-[#E1F5EE]/30"
                style={{ borderColor: "#0F6E56", color: "#0F6E56" }}
              >
                <CircleCheck size={13} aria-hidden="true" /> 문제 없음 → 종료 절차
              </button>
              <button
                type="button"
                onClick={() => onRequestFeedback(latest)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border-[0.5px] bg-transparent px-2 py-2 text-[11px] font-medium transition hover:bg-[#FAEEDA]/30"
                style={{ borderColor: "#854F0B", color: "#854F0B" }}
              >
                <AlertTriangle size={13} aria-hidden="true" /> 문제 있음 → 피드백 작성
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onConfirm(latest)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border-[0.5px] bg-transparent px-2 py-2 text-[11px] font-medium transition hover:bg-[#E1F5EE]/30"
                style={{ borderColor: "#0F6E56", color: "#0F6E56" }}
              >
                <CircleCheck size={13} aria-hidden="true" /> 확인 완료
              </button>
              <button
                type="button"
                onClick={() => onRequestFeedback(latest)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border-[0.5px] bg-transparent px-2 py-2 text-[11px] font-medium transition hover:bg-[#FCF3F0]/60"
                style={{ borderColor: "#D4533E", color: "#D4533E" }}
              >
                <MessageSquare size={13} aria-hidden="true" /> 피드백 작성
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
