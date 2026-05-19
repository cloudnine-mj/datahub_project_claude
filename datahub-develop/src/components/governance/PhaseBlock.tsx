// 단계 페이지 공용 블록 래퍼 — 헤더(아이콘 + 제목 + 우측 영역) + body.
//   emphasized=true 면 외곽이 brand 색으로 강조 (데이터카드 블록 등 핵심 강조용).
//   폰트 weight 는 400/500 만 사용.

import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  /** 헤더 우측에 노출할 배지/텍스트 등 JSX. */
  trailing?: React.ReactNode;
  /** 외곽 강조 (작성 필요 등 핵심 블록 강조용). */
  emphasized?: boolean;
  children: React.ReactNode;
}

export function PhaseBlock({ icon: Icon, title, trailing, emphasized, children }: Props) {
  const borderClass = emphasized
    ? "border-red-200 dark:border-red-900/40"
    : "border-gray-200 dark:border-gray-800";

  return (
    <section
      className={`rounded-xl border bg-white p-4 dark:bg-gray-900 ${borderClass}`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Icon
            size={16}
            aria-hidden="true"
            className="text-gray-500 dark:text-gray-400"
          />
          {title}
        </h2>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </header>
      {children}
    </section>
  );
}
