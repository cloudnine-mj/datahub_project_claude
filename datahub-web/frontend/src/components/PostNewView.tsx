"use client";

// 화면 7: 새 글 작성 폼 — 모든 게시판 공통 (제목/카테고리/내용 + 첨부).
// 중요도(severity) 입력 UI 는 일단 비활성. 편집 시 기존 값은 그대로 보존돼
// payload 로 다시 전달되며, 신규 글은 severity=null 로 생성됨.
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, X } from "lucide-react";
import { api, type BoardType, type Me, type PostVisibility, type Severity } from "@/lib/api";
import { boardSegment } from "./BoardListView";
import { DOC_TYPES, PROCESS_CATEGORIES } from "@/lib/utils";

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * 본문 첫 비어있지 않은 줄을 제목으로 추출 + 그 줄을 본문에서 제거.
 * 마크다운 헤더(#/##/###)면 접두 # 제거. 100자 컷.
 * 첫 줄 추출이 불가능하면(완전 빈 content) title="" / contentRemainder=content 반환.
 */
function extractTitleFromContent(content: string): { title: string; contentRemainder: string } {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.trim());
  if (idx < 0) return { title: "", contentRemainder: content };
  const extractedTitle = lines[idx].replace(/^#+\s*/, "").trim().slice(0, 100);
  const rest = lines.slice();
  rest.splice(idx, 1);
  // 추출된 줄 다음의 선행 빈 줄 정리 — 본문 시작이 어색하지 않도록
  while (rest.length > 0 && !rest[0].trim()) rest.shift();
  return { title: extractedTitle, contentRemainder: rest.join("\n") };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function PostNewView({ board }: { board: BoardType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("id");
  const isEdit = !!editId;
  const isPolicy = board === "policy";

  const [me, setMe] = useState<Me | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [title, setTitle] = useState("");
  const [docNo, setDocNo] = useState("");
  const [docType, setDocType] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState(""); // 입력 중인 태그 텍스트
  const [visibility, setVisibility] = useState<PostVisibility>("public");

  // 파일 첨부 (글 등록 후 순차 업로드)
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setMe);
  }, []);

  // 수정 모드 — 기존 게시글 prefill
  useEffect(() => {
    if (!editId) return;
    api
      .getPost(board, Number(editId))
      .then((p) => {
        setTitle(p.title);
        setDocNo(p.doc_no ?? "");
        setDocType(p.doc_type ?? "");
        setCategory(p.category ?? "");
        setContent(p.content ?? "");
        setSeverity((p.severity as Severity | null) ?? "");
        setTags(p.tags ?? []);
        setVisibility((p.visibility as PostVisibility) ?? "public");
        setAuthorName(p.author_name ?? "");
      })
      .catch((e) => setError((e as Error).message));
  }, [editId, board]);

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" 은(는) 50MB 를 초과합니다.`);
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // 권한 없는 사용자가 직접 URL 로 진입한 경우 화면 12 로 강제 이동
  useEffect(() => {
    if (me && !me.permissions[`can_write_${board}` as const]) {
      router.replace(`/governance/${boardSegment(board)}/forbidden`);
    }
  }, [me, board, router]);

  async function save(asDraft: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      setProgress(asDraft ? "임시저장 중..." : isEdit ? "게시글 수정 중..." : "게시글 저장 중...");
      // 제목 입력 칸이 제거되어 있어 — 본문 첫 비어있지 않은 줄을 제목으로 승격하고
      // 그 줄은 본문에서 제거 (Notion 스타일). 마크다운 헤더(#/##/###)인 경우 # 접두
      // 제거. 100자 컷.
      // 편집 모드에서 이미 title 이 있으면(state 비어있지 않음) 추출 로직 스킵 →
      // content 변경 없음, 기존 title 유지.
      const extracted = extractTitleFromContent(content);
      const finalTitle = title.trim() || extracted.title;
      const finalContent = title.trim() ? content : extracted.contentRemainder;
      const body = {
        title: finalTitle,
        ...(isPolicy
          ? { doc_no: docNo.trim() || null }
          : { doc_type: docType || null }),
        category: category || undefined,
        content: finalContent,
        is_draft: asDraft,
        visibility,
        author_name: authorName.trim() || undefined,
        // 태그는 정책/프로세스 모두 지원. 비어 있으면 null 로 전송.
        tags: tags.length > 0 ? tags : null,
        // 중요도(severity) UI 는 비활성 상태지만 편집 시 기존 값 보존을 위해
        // 정책 보드에 한해 state 그대로 다시 전송.
        ...(isPolicy && {
          severity: severity || null,
        }),
      };
      const post = isEdit
        ? await api.updatePost(board, Number(editId), body)
        : await api.createPost(board, body);

      // 신규 첨부 파일은 그대로 순차 업로드 — 수정 모드에서도 동일.
      for (let i = 0; i < files.length; i++) {
        setProgress(`파일 업로드 중 (${i + 1}/${files.length}): ${files[i].name}`);
        try {
          await api.uploadPostAttachment(board, post.id, files[i]);
        } catch (e) {
          console.error(`업로드 실패 (${files[i].name}):`, e);
        }
      }

      if (asDraft || isEdit) {
        // 임시저장 / 수정 모두 상세 페이지로 이동해 결과 확인
        router.push(`/governance/${boardSegment(board)}/${post.id}`);
      } else {
        router.push(`/governance/${boardSegment(board)}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setProgress(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save(false);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">
        {isEdit ? "글 수정" : isPolicy ? "새 정책 작성" : "새 프로세스 작성"}
      </h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        {/* 기본 입력 */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-bold text-gray-700">기본 정보</h2>
          <div className="space-y-5">
            <Field label="작성자" required>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="작성자명을 입력하세요"
                maxLength={100}
                className={inputCls}
              />
            </Field>

            {isPolicy && (
              <Field label="관리 번호" required hint="문서 식별용 번호 (예: POL-2026-001)">
                <input
                  value={docNo}
                  onChange={(e) => setDocNo(e.target.value)}
                  required
                  placeholder="관리 번호를 입력하세요"
                  maxLength={50}
                  className={inputCls}
                />
              </Field>
            )}

            {!isPolicy && (
              <Field label="유형" required hint="가이드 / 공지 등 문서의 성격">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">유형을 선택하세요</option>
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            )}

            {/* 카테고리 — 정책 게시판에는 노출하지 않음 (다른 게시판만) */}
            {!isPolicy && (
              <Field label="카테고리" required>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">카테고리를 선택하세요</option>
                  {PROCESS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            )}

            {/* 태그 — 정책/프로세스 모두 노출. 필수 아님. */}
            <Field label="태그">
              <TagInput value={tags} onChange={setTags} draft={tagDraft} onDraft={setTagDraft} />
            </Field>

            <Field label="내용" required hint="마크다운 지원">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={16}
                placeholder=""
                className={inputCls + " font-mono"}
              />
            </Field>
          </div>
        </section>

        {/* 파일 첨부 — 글 등록 후 순차 업로드 */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-bold text-gray-700">파일 첨부</h2>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={
              "cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition " +
              (dragActive
                ? "border-brand bg-brand/5"
                : "border-gray-300 bg-gray-50/40 hover:border-brand/60 hover:bg-gray-50")
            }
          >
            <Upload size={20} className="mx-auto text-gray-400" />
            <p className="mt-2 text-sm font-semibold">파일을 드래그하거나 클릭하여 업로드하세요</p>
            <p className="mt-1 text-xs text-gray-500">최대 50MB · 여러 파일 가능</p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold">
              📎 파일 선택
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-gray-400">📎</span>
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">{formatBytes(f.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                    aria-label="제거"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {progress && <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{progress}</div>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-200 px-5 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            취소
          </button>
          {/* 임시저장 — 신규 작성 모드에서만 노출. 수정 모드에선 의미 없음. */}
          {!isEdit && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => save(true)}
              className="rounded-md border border-gray-200 bg-white px-5 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              {submitting ? "임시저장 중..." : "임시저장"}
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {submitting ? (isEdit ? "수정 중..." : "등록 중...") : (isEdit ? "수정 저장" : "등록")}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none";

function chipCls(active: boolean) {
  return (
    "rounded px-3 py-1.5 text-xs font-semibold transition " +
    (active ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100")
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-semibold">
          {label}
          {required && <span className="ml-1 text-brand">*</span>}
        </span>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * 태그 입력 — Enter/콤마로 새 태그 추가, 칩 X 로 제거.
 * Backspace 누르면 마지막 태그 제거 (입력 중 텍스트가 비어있을 때만).
 */
function TagInput({
  value,
  onChange,
  draft,
  onDraft,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  draft: string;
  onDraft: (s: string) => void;
}) {
  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      onDraft("");
      return;
    }
    onChange([...value, trimmed]);
    onDraft("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 focus-within:border-brand">
      {value.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
        >
          #{t}
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded text-gray-400 hover:bg-gray-200 hover:text-red-500"
            aria-label="태그 제거"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          // 한글 IME 조합 중 Enter — composition 종료용이므로 무시
          if (e.nativeEvent.isComposing || e.key === "Process") return;
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            e.preventDefault();
            remove(value.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? "태그를 입력하고 Enter (예: 보안)" : ""}
        className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
