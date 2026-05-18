// API 활용 계획서 · 2단계 운영 — 단계 카드 wrapper.
//   status 에 따라 3가지 디자인 분기:
//     done    : 흰 배경 + 회색 보더 + 녹색 체크 헤더 + 완료 배지 + 요약 박스 + '상세' 버튼
//     current : 흰 배경 + 파랑 보더 + 외부 글로우 + '진행 중' 배지 + body + 단계 완료 버튼
//     locked  : 회색 배경 + 점선 보더 + opacity 0.7 + 자물쇠 아이콘 + 활성화 안내

"use client";

import type { ReactNode, Ref } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, Eye, Lock } from "lucide-react";
import type { StepStatus } from "./useOperatePhase";

interface CommonProps {
  cardRef?: Ref<HTMLElement>;
  id: string;
  title: string;
  status: StepStatus;
}

interface DoneProps {
  completedAt: string;
  summary: ReactNode;
  onShowDetail: () => void;
}

interface CurrentProps {
  icon: LucideIcon;
  description: string;
  children: ReactNode;
  completeLabel: string;
  onComplete: () => void;
  canComplete: boolean;
}

interface LockedProps {
  activationHint: string;
}

type Props = CommonProps & {
  done?: DoneProps;
  current?: CurrentProps;
  locked?: LockedProps;
};

export function OperateStepCard({
  cardRef,
  id,
  title,
  status,
  done,
  current,
  locked,
}: Props) {
  if (status === "done" && done) {
    return <DoneCard cardRef={cardRef} id={id} title={title} {...done} />;
  }
  if (status === "current" && current) {
    return <CurrentCard cardRef={cardRef} id={id} title={title} {...current} />;
  }
  if (locked) {
    return <LockedCard cardRef={cardRef} id={id} title={title} {...locked} />;
  }
  return null;
}

function DoneCard({
  cardRef,
  id,
  title,
  completedAt,
  summary,
  onShowDetail,
}: { cardRef?: Ref<HTMLElement>; id: string; title: string } & DoneProps) {
  return (
    <section
      ref={cardRef}
      id={id}
      className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <header className="flex items-center gap-2.5">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-50 dark:bg-green-900/30">
          <Check size={14} aria-hidden="true" className="text-green-700 dark:text-green-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
              완료
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {completedAt} 확인 완료
          </p>
        </div>
        <button
          type="button"
          onClick={onShowDetail}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-transparent px-2.5 py-1 text-[11px] text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Eye size={12} aria-hidden="true" />
          상세
        </button>
      </header>
      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-800/40">{summary}</div>
    </section>
  );
}

function CurrentCard({
  cardRef,
  id,
  title,
  icon: Icon,
  description,
  children,
  completeLabel,
  onComplete,
  canComplete,
}: { cardRef?: Ref<HTMLElement>; id: string; title: string } & CurrentProps) {
  return (
    <section
      ref={cardRef}
      id={id}
      aria-current="step"
      className="rounded-xl border border-blue-200 bg-white px-5 py-4 shadow-[0_0_0_2px_rgba(24,95,165,0.06)] dark:border-blue-900/40 dark:bg-gray-900"
    >
      <header className="flex items-center gap-2.5">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-blue-900/30">
          <Icon size={14} aria-hidden="true" className="text-blue-700 dark:text-blue-300" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
            진행 중
          </span>
        </div>
      </header>
      <p className="mb-3.5 mt-1 pl-[34px] text-xs text-gray-500 dark:text-gray-400">
        {description}
      </p>

      <div className="space-y-2.5">{children}</div>

      <div className="mt-3.5 flex justify-end border-t border-gray-100 pt-3 dark:border-gray-800">
        <button
          type="button"
          onClick={onComplete}
          disabled={!canComplete}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3.5 py-1.5 text-xs font-medium text-blue-700 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300"
        >
          {completeLabel}
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function LockedCard({
  cardRef,
  id,
  title,
  activationHint,
}: { cardRef?: Ref<HTMLElement>; id: string; title: string } & LockedProps) {
  return (
    <section
      ref={cardRef}
      id={id}
      aria-disabled="true"
      className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-5 py-4 opacity-70 dark:border-gray-700 dark:bg-gray-800/30"
    >
      <header className="flex items-center gap-2.5">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <Lock
            size={12}
            aria-hidden="true"
            className="text-gray-400 dark:text-gray-500"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500">{title}</h3>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {activationHint}
          </p>
        </div>
      </header>
    </section>
  );
}
