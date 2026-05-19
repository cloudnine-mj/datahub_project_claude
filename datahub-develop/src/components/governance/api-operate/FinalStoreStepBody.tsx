// 2단계 · 결과물 적재 — current 상태 body.
//   1) 중앙 저장소 적재 (체크) 2) 메타데이터·데이터카드 (2 체크 + 작성 버튼)
//   '작성' 버튼은 /governance/coming-soon 페이지로 보냄 (데이터 신청 3단계와 동일 패턴).

"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, CloudUpload } from "lucide-react";
import { PhaseChecklistRow } from "@/components/governance/PhaseChecklistRow";
import type { FinalStoreStep } from "./useOperatePhase";

interface Props {
  finalStore: FinalStoreStep;
  onToggleStorage: () => void;
  onToggleMetadata: () => void;
  onToggleDataCard: () => void;
}

export function FinalStoreStepBody({
  finalStore,
  onToggleStorage,
  onToggleMetadata,
  onToggleDataCard,
}: Props) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      <SubSection icon={CloudUpload} title="중앙 저장소 적재">
        <PhaseChecklistRow
          id="api-storage-uploaded"
          label="최종 데이터를 중앙 저장소에 적재 완료"
          checked={finalStore.storageUploaded}
          onToggle={onToggleStorage}
        />
      </SubSection>

      <SubSection icon={BookOpen} title="메타데이터 및 데이터카드">
        <div className="space-y-1.5">
          <PhaseChecklistRow
            id="api-metadata-done"
            label="메타데이터 작성 완료"
            checked={finalStore.metadataCompleted}
            onToggle={onToggleMetadata}
            trailing={
              <WriteButton
                onClick={() => router.push("/governance/coming-soon?from=metadata")}
              />
            }
          />
          <PhaseChecklistRow
            id="api-datacard-done"
            label="데이터카드 작성 완료"
            checked={finalStore.dataCardCompleted}
            onToggle={onToggleDataCard}
            trailing={
              <WriteButton
                onClick={() => router.push("/governance/coming-soon?from=datacard")}
              />
            }
          />
        </div>
      </SubSection>
    </div>
  );
}

function SubSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof CloudUpload;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-700">
      <header className="mb-2 flex items-center gap-1.5">
        <Icon size={13} aria-hidden="true" className="text-gray-600 dark:text-gray-300" />
        <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">{title}</span>
      </header>
      {children}
    </div>
  );
}

function WriteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
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
