// 계획 수립 — 좌측 카드: 신청 전 검토 사항.
//   각 항목은 체크박스 + 라벨. 라벨 클릭으로 토글 (접근성).

"use client";

import { ListChecks } from "lucide-react";

interface Props {
  questions: string[];
  checks: Record<string, boolean>;
  onToggle: (q: string) => void;
}

export function ReviewQuestionsCard({ questions, checks, onToggle }: Props) {
  return (
    <section
      aria-label="신청 전 검토 사항"
      className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900"
    >
      <header className="mb-2 flex items-center gap-1.5">
        <ListChecks
          size={14}
          aria-hidden="true"
          className="text-red-700 dark:text-red-300"
        />
        <h3 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
          신청 전 검토 사항
        </h3>
      </header>
      <p className="mb-2.5 text-[11px] text-gray-500 dark:text-gray-400">
        아래 항목을 점검한 뒤 요청서 작성으로 진행하세요.
      </p>
      <ul className="flex flex-col gap-1.5">
        {questions.map((q) => {
          const id = `review-q-${q}`;
          return (
            <li key={q}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2.5 rounded-md bg-gray-50 px-2.5 py-2 transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={!!checks[q]}
                  onChange={() => onToggle(q)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <span className="text-xs text-gray-800 dark:text-gray-200">{q}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
