// 중간 수령·검수·피드백 단계 body (current 상태) — 서브 영역 2개.
//   1) 중간 납품 데이터: 누적 목록 + '새 중간 납품 적재' 점선 버튼
//   2) 검수 결과 및 피드백: 누적 카드(텍스트 + 다운로드 가능 첨부) +
//      입력 카드(textarea + 파일 첨부 + 드래그앤드롭 + [기록])

"use client";

import { useState } from "react";
import { CloudUpload, Download, File } from "lucide-react";
import type { DeliveryStep, FeedbackAttachment } from "./useBuildPhase";
import { FeedbackInput } from "./FeedbackInput";
import { formatFileSize, getFileIcon } from "./feedback-utils";

interface Props {
  delivery: DeliveryStep;
  onAddUpload: () => void;
  onAddFeedback: (content: string, files?: File[]) => void;
}

export function DeliveryStepBody({ delivery, onAddUpload, onAddFeedback }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <SubArea
        title="중간 납품 데이터"
        trailing={`적재 ${delivery.intermediateUploads.length}건`}
      >
        {delivery.intermediateUploads.length > 0 && (
          <div className="mb-2.5 flex flex-col gap-1.5">
            {delivery.intermediateUploads.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-[11px] dark:bg-gray-800/40"
              >
                <File
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-gray-500 dark:text-gray-400"
                />
                <span className="flex-1 text-gray-800 dark:text-gray-200">{u.label}</span>
                <span className="text-gray-400 dark:text-gray-500">{u.uploadedAt}</span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            console.log("[stub] 새 중간 납품 적재");
            onAddUpload();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-[11px] text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <CloudUpload size={13} aria-hidden="true" />
          새 중간 납품 적재
        </button>
      </SubArea>

      <SubArea
        title="검수 결과 및 피드백"
        trailing={`기록 ${delivery.feedbacks.length}건`}
      >
        {delivery.feedbacks.length > 0 && (
          <ul className="mb-2.5 flex flex-col gap-2">
            {delivery.feedbacks.map((f) => (
              <li
                key={f.id}
                className="rounded-md bg-gray-50 px-2.5 py-2 text-[11px] dark:bg-gray-800/40"
              >
                <div className="mb-1 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {f.author}
                  </span>
                  <span>·</span>
                  <span>{f.createdAt}</span>
                </div>
                {f.content && (
                  <p className="leading-relaxed text-gray-700 dark:text-gray-200">
                    {f.content}
                  </p>
                )}
                {f.attachments.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {f.attachments.map((a) => (
                      <li key={a.id}>
                        <RecordedAttachment att={a} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        <FeedbackInput
          onSubmit={(text, files) => onAddFeedback(text, files)}
          onError={(msg) => {
            setError(msg);
            setTimeout(() => setError(null), 3000);
          }}
        />

        {error && (
          <p className="mt-1.5 whitespace-pre-line text-[11px] text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </SubArea>
    </>
  );
}

function RecordedAttachment({ att }: { att: FeedbackAttachment }) {
  const { Icon, className } = getFileIcon(att.filename);
  return (
    <a
      href={att.downloadUrl}
      download={att.filename}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-800 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
    >
      <Icon size={13} aria-hidden="true" className={`shrink-0 ${className}`} />
      <span>{att.filename}</span>
      <span className="text-gray-400 dark:text-gray-500">·</span>
      <span className="text-gray-400 dark:text-gray-500">{formatFileSize(att.filesize)}</span>
      <Download
        size={11}
        aria-hidden="true"
        className="ml-1 text-gray-400 dark:text-gray-500"
      />
    </a>
  );
}

function SubArea({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{trailing}</span>
      </div>
      {children}
    </div>
  );
}
