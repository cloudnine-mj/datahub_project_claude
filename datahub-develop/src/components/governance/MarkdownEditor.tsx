"use client";

/**
 * 마크다운 read-only 렌더 — react-markdown + remark-gfm 기반.
 *
 * GFM 으로 표 / 체크리스트 / 취소선 / 자동 링크 지원.
 * 스타일은 globals.css 의 .markdown-body 규칙으로 일괄 적용.
 *
 * 작성은 plain textarea — 입력용 에디터는 별도 export 하지 않음.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownView({ source }: { source: string | null | undefined }) {
  if (!source || !source.trim()) return null;
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
