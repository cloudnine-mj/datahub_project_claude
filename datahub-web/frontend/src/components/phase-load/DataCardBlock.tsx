// 3단계 / 블록 2 — 데이터카드 작성 체크리스트 (핵심 블록 — emphasized).
//   필드 4가지 상태로 분기 렌더:
//     auto-filled / filled: 회색 배경 + 체크 아이콘 + 출처 라벨
//     needs-input: 주황(warning) 배경 + 편집 아이콘 + 작성 버튼
//     optional: 회색 배경 + 빈 원 아이콘 + '선택' 라벨

"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, Check, Circle, Pencil } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseStatusBadge } from "@/components/PhaseStatusBadge";

export type FieldStatus = "auto-filled" | "needs-input" | "optional" | "filled";

export interface DataCardField {
  id: string;
  label: string;
  status: FieldStatus;
  /** auto-filled 일 때 출처 — '자동 채움' / '신청서에서 가져옴' 등 */
  sourceLabel?: string;
}

interface Props {
  fields: DataCardField[];
}

export function DataCardBlock({ fields }: Props) {
  return (
    <PhaseBlock
      icon={BookOpen}
      title="데이터카드 작성"
      trailing={<PhaseStatusBadge variant="warning">초안 · 작성 필요</PhaseStatusBadge>}
      emphasized
    >
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        신청서 내용을 기반으로 자동 생성된 초안입니다. 비어 있는 필드를 채워주세요.
      </p>
      <ul className="space-y-1.5">
        {fields.map((f) => (
          <li key={f.id}>
            <FieldRow field={f} />
          </li>
        ))}
      </ul>
    </PhaseBlock>
  );
}

function FieldRow({ field }: { field: DataCardField }) {
  const isFilled = field.status === "auto-filled" || field.status === "filled";
  const isNeeded = field.status === "needs-input";

  let bgClass = "bg-gray-50 dark:bg-gray-800/40";
  let LeftIcon: LucideIcon = Circle;
  let leftIconClass = "text-gray-300 dark:text-gray-600";
  let labelClass = "text-sm text-gray-700 dark:text-gray-300";
  let trailing: React.ReactNode = null;

  if (isFilled) {
    LeftIcon = Check;
    leftIconClass = "text-green-700 dark:text-green-300";
    trailing = (
      <span className="text-xs text-green-700 dark:text-green-300">
        {field.sourceLabel ?? "자동 채움"}
      </span>
    );
  } else if (isNeeded) {
    bgClass = "bg-amber-50 dark:bg-amber-900/20";
    LeftIcon = Pencil;
    leftIconClass = "text-amber-700 dark:text-amber-400";
    labelClass = "text-sm font-medium text-gray-900 dark:text-gray-100";
    trailing = (
      <button
        type="button"
        onClick={() => console.log("[stub] 데이터카드 필드 작성", field.id)}
        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-50 dark:border-amber-900/40 dark:bg-gray-900 dark:text-amber-200 dark:hover:bg-gray-800"
      >
        작성
        <ArrowRight size={12} aria-hidden="true" />
      </button>
    );
  } else {
    // optional
    labelClass = "text-sm text-gray-500 dark:text-gray-400";
    trailing = (
      <span className="text-xs text-gray-400 dark:text-gray-500">선택</span>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-2 ${bgClass}`}
    >
      <LeftIcon size={14} aria-hidden="true" className={leftIconClass} />
      <span className={`flex-1 ${labelClass}`}>{field.label}</span>
      {trailing}
    </div>
  );
}
