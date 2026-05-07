"use client";

/**
 * 마크다운 렌더 — react-markdown + remark-gfm.
 * 스타일은 globals.css 의 .markdown-body 규칙으로 일괄 적용.
 *
 * GFM 으로 표/체크리스트/취소선/자동 링크 지원.
 * 빈 문자열·null 입력은 아무것도 렌더하지 않음.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  if (!source || !source.trim()) return null;
  return (
    <div className={"markdown-body " + (className ?? "")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
