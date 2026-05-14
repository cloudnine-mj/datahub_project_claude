// 데이터 도입 유형 1장 — 아이콘 / 제목 / 설명 / 메타 3줄 / 예시 박스 / CTA 버튼.
// 데이터 정의는 lib/applicationTypes.ts. 시각만 여기서 책임.
// 폰트 weight 는 400/500 만 (font-normal, font-medium).

"use client";

import type { ApplicationType } from "@/lib/applicationTypes";

interface Props {
  data: ApplicationType;
  onSelect: () => void;
}

export function ApplicationTypeCard({ data, onSelect }: Props) {
  const Icon = data.icon;
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600">
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${data.iconBgClass}`}>
        <Icon size={20} className={data.iconColorClass} />
      </div>

      <h3 className="mt-4 text-[15px] font-medium text-gray-900 dark:text-gray-100">
        {data.title}
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{data.description}</p>

      <div className="mt-3 space-y-1.5">
        {data.metaItems.map((m) => {
          const MetaIcon = m.icon;
          return (
            <div key={m.label} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <MetaIcon size={12} />
                {m.label}
              </span>
              <span className="text-right font-medium text-gray-800 dark:text-gray-200">
                {m.value}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
        {data.examples}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="mt-auto pt-3"
      >
        <div className="rounded-lg bg-[#E6F1FB] px-3 py-2 text-center text-sm font-medium text-[#185FA5] transition hover:brightness-95 dark:bg-blue-900/30 dark:text-blue-300">
          신청서 작성하기 →
        </div>
      </button>
    </div>
  );
}
