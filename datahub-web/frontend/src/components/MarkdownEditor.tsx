"use client";

/**
 * 마크다운 에디터 — @uiw/react-md-editor 기반.
 *
 * 기능:
 *   - 툴바: 헤딩 / 굵게 / 기울임 / 인용 / 리스트 / 링크 / 이미지 / 코드
 *   - 분할 미리보기 (라이브)
 *   - 이미지: 툴바 버튼 클릭 → 파일 선택 → 업로드 → 본문에 ![alt](url) 자동 삽입
 *   - 이미지: 클립보드 paste (Cmd/Ctrl + V) 도 지원
 *   - 이미지: drag&drop 도 지원
 *
 * SSR 충돌 방지를 위해 dynamic import (ssr: false).
 */

import "@uiw/react-md-editor/markdown-editor.css";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { commands, type ICommand } from "@uiw/react-md-editor";
import { api } from "@/lib/api";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface Props {
  value: string;
  onChange: (v: string) => void;
  height?: number;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, height = 400, placeholder }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insertImage = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const res = await api.uploadImage(file);
        // alt 텍스트의 ']' / '[' / 줄바꿈은 마크다운 파싱을 깨뜨리니 제거.
        // URL 은 백엔드에서 이미 URL-safe (token+ext) 형태로 돌려줌.
        const safeAlt = (res.filename || "image").replace(/[\[\]\n\r]/g, " ").trim();
        const md = `\n![${safeAlt}](${res.url})\n`;
        onChange((value ?? "") + md);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [onChange, value],
  );

  // 툴바 이미지 버튼 — 파일 선택 → 업로드 → 본문에 ![](url) 삽입
  const imageCommand: ICommand = {
    name: "imageUpload",
    keyCommand: "imageUpload",
    buttonProps: { "aria-label": "이미지 업로드", title: "이미지 업로드" },
    icon: (
      <svg width="14" height="14" viewBox="0 0 20 20">
        <path
          fill="currentColor"
          d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm0 1v9.5l3.5-3.5 3 3 2-2 3.5 3.5V4H4zm9 3a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
        />
      </svg>
    ),
    execute: () => {
      fileInputRef.current?.click();
    },
  };

  // 붙여넣기/드롭 이벤트에서 이미지 추출 — onPaste/onDrop 가 wrapping div 에 걸린다.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          insertImage(f);
          return;
        }
      }
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    if (e.dataTransfer.files.length === 0) return;
    const imgs = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    e.preventDefault();
    for (const f of imgs) insertImage(f);
  }

  return (
    <div onPaste={onPaste} onDrop={onDrop} data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={height}
        textareaProps={{ placeholder }}
        commands={[
          commands.bold,
          commands.italic,
          commands.strikethrough,
          commands.hr,
          commands.title,
          commands.divider,
          commands.link,
          commands.quote,
          commands.code,
          commands.codeBlock,
          imageCommand,
          commands.unorderedListCommand,
          commands.orderedListCommand,
          commands.checkedListCommand,
        ]}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) insertImage(f);
          e.target.value = "";
        }}
      />
      {(uploading || error) && (
        <div className="mt-1.5 text-xs">
          {uploading && <span className="text-blue-600">이미지 업로드 중...</span>}
          {error && <span className="text-red-600">업로드 실패: {error}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * 마크다운 read-only 렌더 — 정책 상세에서 사용.
 * 동일하게 dynamic import 로 로드.
 */
const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((m) => m.default.Markdown),
  { ssr: false },
);

export function MarkdownView({ source }: { source: string | null | undefined }) {
  if (!source || !source.trim()) return null;
  return (
    <div data-color-mode="light">
      <MDPreview source={source} style={{ background: "transparent" }} />
    </div>
  );
}
