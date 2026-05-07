"use client";

/**
 * 마크다운 read-only 렌더 — Toast UI Viewer 기반.
 *
 * 정책 상세에서 본문(post.content) 을 마크다운으로 파싱해 표시.
 * 작성 자체는 plain textarea 를 사용하므로 입력용 에디터는 더 이상 export 하지 않음.
 */

import "@toast-ui/editor/dist/toastui-editor.css";
import dynamic from "next/dynamic";

const Viewer = dynamic(
  () => import("@toast-ui/react-editor").then((m) => m.Viewer),
  { ssr: false },
) as unknown as typeof import("@toast-ui/react-editor").Viewer;

export function MarkdownView({ source }: { source: string | null | undefined }) {
  if (!source || !source.trim()) return null;
  return (
    <div data-color-mode="light">
      <Viewer initialValue={source} />
    </div>
  );
}
