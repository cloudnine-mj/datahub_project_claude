// 신청서 양식 안에 인라인으로 들어가는 첨부파일 입력 — table row 의 값 칸에 렌더.
//
// Phase 1: sessionStorage 영속 mock. key 는 form 컨텍스트에 따라 달라짐:
//   - 임시저장 후(formId 있음): dh:gov:attachments:{formId}
//   - 그 전(formId 없음): dh:gov:attachments:draft-temp:{type} — 같은 유형 신청서에 임시.
//   첫 임시저장으로 formId 가 생기면 detail 페이지의 AttachmentSection 과 동일 키 공유.
//
// UI: [파일 업로드] 버튼 + 칩 목록 (타입별 아이콘, 다운로드, 제거).
// 백엔드 업로드 API(uploadFormAttachment) 미구현이라 ObjectURL 로 in-session 다운로드만.

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  X,
} from "lucide-react";

interface MockAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  /** ObjectURL — 같은 세션 내에서만 유효 (sessionStorage 영속 X). */
  blobUrl: string;
}

interface Props {
  /** 임시저장 후 폼 id. null 이면 임시 키 사용. */
  formId: string | null;
  /** 신청 유형 — formId 없을 때 임시 키 분리용. */
  applicationType: string;
  disabled?: boolean;
}

const MAX_BYTES = 50 * 1024 * 1024;

function storageKey(formId: string | null, applicationType: string): string {
  return formId
    ? `dh:gov:attachments:${formId}`
    : `dh:gov:attachments:draft-temp:${applicationType}`;
}

type StoredMock = Omit<MockAttachment, "blobUrl">;

/** 미리보기 등 외부에서 사용할 저장 첨부 항목 타입(파일명·크기). */
export type StoredAttachment = StoredMock;

/** 현재 폼 컨텍스트(formId 또는 임시 키)의 저장 첨부 목록을 읽는다.
 *  제출 전 검토 모달이 동일 키에서 첨부를 표시하는 데 사용. */
export function readStoredAttachments(
  formId: string | null,
  applicationType: string,
): StoredAttachment[] {
  return readStored(storageKey(formId, applicationType));
}

function readStored(key: string): StoredMock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as StoredMock[];
  } catch {
    return [];
  }
}

function writeStored(key: string, list: MockAttachment[]): void {
  if (typeof window === "undefined") return;
  try {
    const stored = list.map(({ blobUrl, ...rest }) => {
      void blobUrl;
      return rest;
    });
    sessionStorage.setItem(key, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function pickIcon(filename: string): {
  Icon: typeof FileIcon;
  color: string;
} {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return { Icon: FileText, color: "#A32D2D" };
  if (ext === "xls" || ext === "xlsx" || ext === "csv")
    return { Icon: FileSpreadsheet, color: "#3B6D11" };
  if (ext === "doc" || ext === "docx") return { Icon: FileText, color: "#185FA5" };
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
    return { Icon: ImageIcon, color: "#7C3AED" };
  return { Icon: FileIcon, color: "#6B7280" };
}

export function InlineAttachmentInput({ formId, applicationType, disabled }: Props) {
  const [files, setFiles] = useState<MockAttachment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = storageKey(formId, applicationType);
    setFiles(readStored(key).map((s) => ({ ...s, blobUrl: "" })));
  }, [formId, applicationType]);

  function persist(next: MockAttachment[]) {
    setFiles(next);
    writeStored(storageKey(formId, applicationType), next);
  }

  function onPick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null);
    const picked = e.target.files;
    if (!picked || picked.length === 0) return;
    const next: MockAttachment[] = [...files];
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      if (f.size > MAX_BYTES) {
        setErr(`"${f.name}" 은(는) 50MB 를 초과합니다.`);
        continue;
      }
      next.push({
        id: `mock-${Date.now()}-${i}`,
        filename: f.name,
        sizeBytes: f.size,
        blobUrl: URL.createObjectURL(f),
      });
    }
    persist(next);
    e.target.value = "";
  }

  function onRemove(id: string) {
    persist(files.filter((f) => f.id !== id));
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Paperclip size={13} aria-hidden="true" /> 파일 업로드
        </button>
        {files.length > 0 ? (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            총 {files.length}개
          </span>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            샘플 데이터, 작업 가이드라인 등 · 최대 50MB
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg"
          className="hidden"
          onChange={onChange}
          disabled={disabled}
        />
      </div>

      {err && (
        <p className="mb-2 text-[11px] text-red-700" role="alert">
          {err}
        </p>
      )}

      {files.length === 0 ? (
        <p className="text-[11px] text-gray-400">첨부된 파일이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {files.map((f) => {
            const { Icon, color } = pickIcon(f.filename);
            return (
              <div
                key={f.id}
                className="flex items-center gap-2.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800/40"
              >
                <Icon size={15} style={{ color }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-gray-900 dark:text-gray-100">
                    {f.filename}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">
                    {formatBytes(f.sizeBytes)}
                  </div>
                </div>
                {f.blobUrl && (
                  <a
                    href={f.blobUrl}
                    download={f.filename}
                    aria-label={`${f.filename} 다운로드`}
                    className="text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <Download size={13} aria-hidden="true" />
                  </a>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemove(f.id)}
                    aria-label={`${f.filename} 제거`}
                    className="text-gray-400 transition hover:text-red-600 dark:hover:text-red-400"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
