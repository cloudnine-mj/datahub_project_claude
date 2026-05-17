// 계획 수립 — 좌측 카드: 신청 전 검토 사항 (체크박스 없음, 순수 질문 텍스트).
//   각 질문 row 는 회색 박스로 카드 안에서 시각적으로 묶음.

import { ListChecks } from "lucide-react";

interface Props {
  questions: string[];
}

export function ReviewQuestionsCard({ questions }: Props) {
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
        아래 질문에 답할 수 있다면 신청서 작성으로 진행하세요.
      </p>
      <ul className="flex flex-col gap-1.5">
        {questions.map((q) => (
          <li
            key={q}
            className="rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-800 dark:bg-gray-800/40 dark:text-gray-200"
          >
            {q}
          </li>
        ))}
      </ul>
    </section>
  );
}
