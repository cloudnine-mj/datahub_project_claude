// 계획 수립 — 우측 카드: 작성 예시 (학습용, 항상 노출).
//   질문과 1:1 매칭되는 항목명 + 답변. dl/dt/dd 시맨틱.
//   배경은 brand red 계열 (기존 info 톤).

import { Lightbulb } from "lucide-react";
import type { PlanningReviewExample } from "@/lib/planningConfig";

interface Props {
  title: string;
  subtitle: string;
  items: PlanningReviewExample[];
}

export function ReviewExampleCard({ title, subtitle, items }: Props) {
  return (
    <section
      aria-label="작성 예시"
      className="rounded-xl border border-gray-200 bg-red-50 px-4 py-3.5 dark:border-gray-800 dark:bg-red-900/20"
    >
      <header className="mb-2 flex items-center gap-1.5">
        <Lightbulb
          size={14}
          aria-hidden="true"
          className="text-red-700 dark:text-red-300"
        />
        <h3 className="text-[13px] font-medium text-red-700 dark:text-red-300">
          {title}
        </h3>
      </header>
      {subtitle && (
        <p className="mb-2.5 text-[11px] text-red-700/80 dark:text-red-300/80">
          {subtitle}
        </p>
      )}
      <dl className="flex flex-col gap-2 text-[11px] leading-relaxed">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="mb-0.5 font-medium text-red-700 dark:text-red-300">
              {it.label}
            </dt>
            <dd className="text-gray-600 dark:text-gray-300">{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
