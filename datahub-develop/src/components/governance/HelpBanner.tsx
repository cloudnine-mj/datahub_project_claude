// info 아이콘 + 안내 텍스트 + 선택적 CTA 링크. 작성 페이지 등에서 안내 배너로 사용.
// 폰트 weight 는 400/500 만 (font-normal, font-medium).

"use client";

import { ExternalLink, Info } from "lucide-react";

interface Props {
  message: string;
  /** CTA 클릭 가능 라벨 — 없으면 단순 안내 텍스트만 노출 */
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function HelpBanner({ message, ctaLabel, onCtaClick }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-200">
      <Info size={16} className="mt-0.5 shrink-0" />
      <p className="leading-relaxed">
        {message}
        {ctaLabel && (
          <button
            type="button"
            onClick={onCtaClick}
            className="ml-1 inline-flex items-center gap-0.5 font-medium underline underline-offset-2 hover:opacity-80"
          >
            {ctaLabel}
            <ExternalLink size={11} />
          </button>
        )}
      </p>
    </div>
  );
}
