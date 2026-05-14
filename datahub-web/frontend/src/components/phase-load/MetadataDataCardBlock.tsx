// 3단계 / 블록 2 — 메타데이터 및 데이터카드 작성.
//   2 체크 row (각 row 우측에 '작성' 버튼). 신청서 내용이 초안으로 반영.

"use client";

import { ArrowRight, BookOpen } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseChecklistRow } from "@/components/PhaseChecklistRow";

interface Props {
  metadataChecked: boolean;
  datacardChecked: boolean;
  onToggleMetadata: () => void;
  onToggleDatacard: () => void;
}

export function MetadataDataCardBlock({
  metadataChecked,
  datacardChecked,
  onToggleMetadata,
  onToggleDatacard,
}: Props) {
  return (
    <PhaseBlock icon={BookOpen} title="메타데이터 및 데이터카드 작성">
      <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
        적재한 데이터에 대한 메타데이터와 데이터카드를 작성하세요. 신청서에 작성한
        내용이 초안으로 반영됩니다.
      </p>
      <ul className="space-y-1.5">
        <li>
          <PhaseChecklistRow
            id="metadata-done"
            label="메타데이터 작성을 완료했다"
            checked={metadataChecked}
            onToggle={onToggleMetadata}
            trailing={
              <WriteButton onClick={() => console.log("[stub] 메타데이터 작성")} />
            }
          />
        </li>
        <li>
          <PhaseChecklistRow
            id="datacard-done"
            label="데이터카드 작성을 완료했다"
            checked={datacardChecked}
            onToggle={onToggleDatacard}
            trailing={
              <WriteButton onClick={() => console.log("[stub] 데이터카드 작성")} />
            }
          />
        </li>
      </ul>
    </PhaseBlock>
  );
}

function WriteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // label 클릭으로 체크박스가 토글되는 것을 방지.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      작성
      <ArrowRight size={12} aria-hidden="true" />
    </button>
  );
}
