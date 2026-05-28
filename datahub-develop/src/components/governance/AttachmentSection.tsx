// 첨부파일 섹션 — 빨간 막대 헤더 + 개수 배지 + 우측 [파일 업로드] 버튼.
//
//   ┌─ 첨부파일  [2]                              [파일 업로드] ─┐
//   │ ┌─ 작업_요구사항_정의서.pdf  1.2 MB        ↓  X ─┐          │
//   │ └─                                                        │
//   │ ┌─ 데이터_샘플.xlsx  340 KB                ↓  X ─┐         │
//   │ └─                                                        │
//   └──────────────────────────────────────────────────────────┘
//
// Phase 1: 업로드 API(uploadFormAttachment) 가 미구현이라 sessionStorage 에
// mock 으로 영속. Phase 2 백엔드 연결 시 sessionStorage 부분만 교체.
// 백엔드 첨부파일(form.attachments) 이 있으면 함께 노출 — 다운로드만 가능.

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
import { api } from "@/lib/governance/api-client-full";

interface BackendAttachment {
  id: string;
  filename: string;
  size_bytes: number;
}

interface MockAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  /** 업로드 시점에 생성한 ObjectURL — 다운로드용. 페이지 떠나면 만료. */
  blobUrl: string;
}

interface Props {
  formId: string;
  backend: BackendAttachment[];
  /** 신청 정보 표 안의 한 행으로 끼워 넣을 때 — 빨간 막대 헤더/외곽 박스 없이
   *  업로드 버튼 + 파일 목록만 렌더 (라벨은 표의 행 라벨이 담당). */
  embedded?: boolean;
}

const MAX_BYTES = 50 * 1024 * 1024;
const STORAGE_KEY = (formId: string) => `dh:gov:attachments:${formId}`;
// blobUrl 은 ObjectURL 이라 sessionStorage 영속이 의미 없지만, 메타데이터(이름·크기·id) 만
// 직렬화. 새 세션에서는 blobUrl 비어있어 다운로드 불가 — 그때는 칩만 표시.
type StoredMock = Omit<MockAttachment, "blobUrl">;

function readStored(formId: string): StoredMock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY(formId));
    if (!raw) return [];
    return JSON.parse(raw) as StoredMock[];
  } catch {
    return [];
  }
}

function writeStored(formId: string, list: MockAttachment[]): void {
  if (typeof window === "undefined") return;
  try {
    const stored = list.map(({ blobUrl, ...rest }) => {
      void blobUrl;
      return rest;
    });
    sessionStorage.setItem(STORAGE_KEY(formId), JSON.stringify(stored));
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

export function AttachmentSection({ formId, backend, embedded = false }: Props) {
  const [mocks, setMocks] = useState<MockAttachment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStored(formId);
    // 새 세션에서는 blobUrl 비어있음 — 다운로드 시 '미지원' 처리.
    setMocks(stored.map((s) => ({ ...s, blobUrl: "" })));
  }, [formId]);

  function persist(next: MockAttachment[]) {
    setMocks(next);
    writeStored(formId, next);
  }

  function onPickFile() {
    inputRef.current?.click();
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const next: MockAttachment[] = [...mocks];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" 은(는) 50MB 를 초과합니다.`);
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
    // 같은 파일 다시 선택 가능하도록 input 비움.
    e.target.value = "";
  }

  function onRemove(id: string) {
    persist(mocks.filter((m) => m.id !== id));
  }

  const total = backend.length + mocks.length;

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg"
      className="hidden"
      onChange={onFileSelected}
    />
  );

  const errorMsg = error ? (
    <p className="mb-2 text-[11px] text-red-700" role="alert">
      {error}
    </p>
  ) : null;

  const fileList =
    total > 0 ? (
      <div className={`flex flex-col gap-2 ${embedded ? "mb-2.5" : "mb-3"}`}>
        {backend.map((a) => (
          <FileChip
            key={`b-${a.id}`}
            filename={a.filename}
            sizeBytes={a.size_bytes}
            downloadHref={api.formAttachmentUrl(formId, a.id)}
          />
        ))}
        {mocks.map((m) => (
          <FileChip
            key={m.id}
            filename={m.filename}
            sizeBytes={m.sizeBytes}
            downloadHref={m.blobUrl || undefined}
            onRemove={() => onRemove(m.id)}
          />
        ))}
      </div>
    ) : null;

  const uploadRow = (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={onPickFile}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <Paperclip size={13} aria-hidden="true" /> 파일 업로드
      </button>
      <span className="text-[11px] text-gray-400 dark:text-gray-500">
        샘플 데이터, 작업 가이드라인 등 · 최대 50MB
      </span>
    </div>
  );

  // 신청 정보 표 안의 행으로 끼워 넣을 때 — 헤더/외곽 박스 없이 목록 + 업로드만.
  if (embedded) {
    return (
      <div>
        {hiddenInput}
        {errorMsg}
        {fileList}
        {uploadRow}
      </div>
    );
  }

  return (
    <section>
      {/* 헤더 — 빨간 막대 + 제목 + 개수 (업로드 버튼은 아래 박스 안으로 이동) */}
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          첨부파일
        </h3>
        {total > 0 && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {total}
          </span>
        )}
      </div>

      {hiddenInput}
      {errorMsg}

      {/* 등록 박스 — 업로드 버튼 + 안내를 박스 안에 두고, 파일이 있으면 위에 목록 표시 */}
      <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900">
        {fileList}
        {uploadRow}
      </div>
    </section>
  );
}

function FileChip({
  filename,
  sizeBytes,
  downloadHref,
  onRemove,
}: {
  filename: string;
  sizeBytes: number;
  downloadHref?: string;
  onRemove?: () => void;
}) {
  const { Icon, color } = pickIcon(filename);
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40">
      <Icon size={18} style={{ color }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-gray-900 dark:text-gray-100">
          {filename}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500">
          {formatBytes(sizeBytes)}
        </div>
      </div>
      {downloadHref && downloadHref !== "#" && (
        <a
          href={downloadHref}
          download={filename}
          aria-label={`${filename} 다운로드`}
          className="text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
        >
          <Download size={15} aria-hidden="true" />
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${filename} 제거`}
          className="text-gray-400 transition hover:text-red-600 dark:hover:text-red-400"
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
