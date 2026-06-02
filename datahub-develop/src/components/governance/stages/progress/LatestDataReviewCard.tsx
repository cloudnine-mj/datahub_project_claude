// 최신 데이터 검토 카드 — 진행 단계 60:40 좌측. 가장 최근 업로드된 파일을 보여주고,
//   [문제 없음 → 종료 절차] / [문제 있음 → 피드백 작성] 두 분기 제공.

"use client";

import { useState } from "react";
import { AlertTriangle, CircleCheck, FileText } from "lucide-react";
import {
  deliveryColors,
  deliveryShortLabel,
  fileTypeColor,
  fileTypeLabel,
  formatBytes,
  formatDateTime,
  type ReceivedDataItem,
} from "@/lib/governance/progress-storage";
import { FeedbackComposer } from "./FeedbackComposer";
import type { FeedbackAttachmentMeta } from "@/lib/governance/progress-storage";

interface Props {
  latest: ReceivedDataItem | null;
  /** 품질 확인 [문제 없음] — 양식 모달 흐름은 별도 작업. 임시 alert. */
  onNoIssue: () => void;
  /** 피드백 전송 — 부모가 storage 저장. */
  onSubmitFeedback: (payload: {
    targetDeliveryRound: ReceivedDataItem["deliveryRound"];
    targetVersion: number;
    content: string;
    attachments: FeedbackAttachmentMeta[];
  }) => void;
}

export function LatestDataReviewCard({ latest, onNoIssue, onSubmitFeedback }: Props) {
  const [composing, setComposing] = useState(false);

  if (!latest) {
    return (
      <section
        className="rounded-[10px] border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[14px] py-[12px] dark:border-gray-700 dark:bg-gray-900"
      >
        <header className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
          <h3 className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
            최신 데이터 검토
          </h3>
        </header>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-gray-200 px-3 py-4 text-[11px] text-gray-400 dark:border-gray-700">
          <FileText size={13} aria-hidden="true" />
          아직 업로드된 데이터가 없습니다.
        </div>
      </section>
    );
  }

  const dc = deliveryColors(latest.deliveryRound);

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
          {deliveryShortLabel(latest.deliveryRound)} v{latest.version} 확인 중
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
          <span className="text-[11px] font-medium text-gray-900 dark:text-gray-100">
            {latest.fileName}
          </span>
        </div>
        <div className="text-[10px] text-[var(--color-text-tertiary,#9ca3af)]" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatBytes(latest.fileSize)} · {latest.uploader} · {formatDateTime(latest.uploadedAt)}
        </div>
      </div>

      {!composing && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="mb-2 text-[10px] font-medium text-[#D4533E]">
            품질 확인 결과 선택
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNoIssue}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border-[0.5px] bg-transparent px-2 py-2 text-[11px] font-medium transition hover:bg-[#E1F5EE]/30"
              style={{ borderColor: "#0F6E56", color: "#0F6E56" }}
            >
              <CircleCheck size={13} aria-hidden="true" /> 문제 없음 → 종료 절차
            </button>
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border-[0.5px] bg-transparent px-2 py-2 text-[11px] font-medium transition hover:bg-[#FAEEDA]/30"
              style={{ borderColor: "#854F0B", color: "#854F0B" }}
            >
              <AlertTriangle size={13} aria-hidden="true" /> 문제 있음 → 피드백 작성
            </button>
          </div>
        </div>
      )}

      {composing && (
        <FeedbackComposer
          targetDeliveryRound={latest.deliveryRound}
          targetVersion={latest.version}
          onCancel={() => setComposing(false)}
          onSubmit={(payload) => {
            onSubmitFeedback({
              targetDeliveryRound: latest.deliveryRound,
              targetVersion: latest.version,
              content: payload.content,
              attachments: payload.attachments,
            });
            setComposing(false);
          }}
        />
      )}
    </section>
  );
}
