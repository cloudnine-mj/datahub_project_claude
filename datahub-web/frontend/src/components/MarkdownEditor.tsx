"use client";

/**
 * 마크다운 에디터 — Toast UI Editor 기반.
 *
 *  - 기본 모드: markdown (raw 마크다운 붙여넣기 자연 동작)
 *  - 우하단 토글로 WYSIWYG 모드 전환 — 워드프로세서처럼 시각 편집
 *  - 표 / 이미지 / 링크 / 헤딩 / 리스트 / 인용 / 코드 등 툴바 내장
 *  - 이미지: 툴바 또는 드래그앤드롭 → addImageBlobHook 으로 백엔드 업로드 후 ![](url) 삽입
 *  - 저장 형식: 마크다운 문자열 (post.content)
 *
 * SSR 충돌 방지를 위해 dynamic({ ssr: false }) 로 로드.
 */

import "@toast-ui/editor/dist/toastui-editor.css";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { Editor as ToastEditor } from "@toast-ui/react-editor";
import { api } from "@/lib/api";

const Editor = dynamic(
  () => import("@toast-ui/react-editor").then((m) => m.Editor),
  { ssr: false },
) as unknown as typeof ToastEditor;

const Viewer = dynamic(
  () => import("@toast-ui/react-editor").then((m) => m.Viewer),
  { ssr: false },
) as unknown as typeof import("@toast-ui/react-editor").Viewer;

interface Props {
  value: string;
  onChange: (v: string) => void;
  height?: number;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, height = 480, placeholder }: Props) {
  const editorRef = useRef<InstanceType<typeof ToastEditor> | null>(null);

  // 부모 value 변경 시 에디터에 동기화 (수정 모드 prefill 등).
  // onChange 가 트리거하는 ping-pong 을 막기 위해 현재 마크다운과 다를 때만 set.
  useEffect(() => {
    const inst = editorRef.current?.getInstance?.();
    if (inst && typeof inst.getMarkdown === "function" && inst.getMarkdown() !== value) {
      inst.setMarkdown(value || "");
    }
  }, [value]);

  return (
    <div data-color-mode="light">
      <Editor
        ref={(r) => {
          editorRef.current = r;
        }}
        initialValue={value || ""}
        previewStyle="tab"
        height={`${height}px`}
        initialEditType="markdown"
        useCommandShortcut
        placeholder={placeholder}
        onChange={() => {
          const md = editorRef.current?.getInstance?.()?.getMarkdown?.() ?? "";
          onChange(md);
        }}
        hooks={{
          addImageBlobHook: async (blob: Blob, callback: (url: string, alt?: string) => void) => {
            try {
              const f =
                blob instanceof File
                  ? blob
                  : new File([blob], "image.png", { type: blob.type || "image/png" });
              const res = await api.uploadImage(f);
              callback(res.url, res.filename);
            } catch (e) {
              console.error("이미지 업로드 실패:", e);
            }
          },
        }}
      />
    </div>
  );
}

/**
 * 정책 상세에서 사용하는 read-only 마크다운 뷰.
 */
export function MarkdownView({ source }: { source: string | null | undefined }) {
  if (!source || !source.trim()) return null;
  return (
    <div data-color-mode="light">
      <Viewer initialValue={source} />
    </div>
  );
}
