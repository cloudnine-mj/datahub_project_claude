// 3단계 / 블록 1 — 최종 데이터 적재 현황.
//   저장소 경로 + 메타(회차 통합 / 건수 / 용량) + 적재 완료 표시.

"use client";

import { Check, CloudUpload, Folder } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseStatusBadge } from "@/components/PhaseStatusBadge";

export interface DatasetUpload {
  path: string;
  totalCount: number;
  totalSize: string;
  rounds: number;
  status: "in-progress" | "completed";
}

interface Props {
  upload: DatasetUpload | null;
}

export function DatasetUploadBlock({ upload }: Props) {
  if (!upload) {
    return (
      <PhaseBlock icon={CloudUpload} title="최종 데이터 적재">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          아직 데이터가 적재되지 않았습니다. 2단계에서 최종 데이터 수령을 완료해 주세요
        </p>
      </PhaseBlock>
    );
  }

  const trailing =
    upload.status === "completed" ? (
      <PhaseStatusBadge variant="success">적재 완료</PhaseStatusBadge>
    ) : (
      <PhaseStatusBadge variant="info">진행 중</PhaseStatusBadge>
    );

  return (
    <PhaseBlock icon={CloudUpload} title="최종 데이터 적재" trailing={trailing}>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
        <div className="flex min-w-0 items-center gap-3">
          <Folder
            size={24}
            aria-hidden="true"
            className="shrink-0 text-red-600 dark:text-red-400"
          />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
              {upload.path}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              총 {upload.rounds}회차 통합 ·{" "}
              {upload.totalCount.toLocaleString("ko-KR")}건 · {upload.totalSize}
            </p>
          </div>
        </div>
        {upload.status === "completed" && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300">
            <Check size={12} aria-hidden="true" />
            적재 완료
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        중앙 저장소 적재가 완료되면 데이터카드 작성을 진행해 주세요. 신청서에 작성한
        메타데이터가 자동으로 데이터카드 초안에 반영됩니다.
      </p>
    </PhaseBlock>
  );
}
