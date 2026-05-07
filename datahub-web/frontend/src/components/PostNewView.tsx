"use client";

// 화면 7: 새 글 작성 폼.
//
// 정책 게시판(policy)일 때는 추가 메타필드(summary/tags/severity/applies_to/tldr/
// action_items/examples) 입력 영역이 같이 보임. 다른 게시판은 단순 폼 그대로.
// 파일 첨부는 글 등록 후 순차 업로드 (FormBuilder 와 동일 패턴).
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, X } from "lucide-react";
import { api, type BoardType, type Me, type Severity } from "@/lib/api";
import { boardSegment } from "./BoardListView";
import { PolicyExampleModal } from "./PolicyExampleModal";
import { SEVERITIES } from "./SeverityBadge";

const SEVERITY_VALUES = ["required", "recommended"] as const;
function parseSeverityParam(v: string | null): Severity | "" {
  return v && (SEVERITY_VALUES as readonly string[]).includes(v) ? (v as Severity) : "";
}

const CATEGORIES = ["데이터 관리 정책", "데이터 제작 프로세스", "데이터 활용 요청 프로세스"];
const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function PostNewView({ board }: { board: BoardType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPolicy = board === "policy";

  // 정책 목록의 필터 탭에서 진입한 경우 ?severity=... 가 붙어 있음.
  // 폼 초기값과 예시 모달 기본 탭 양쪽에 사용.
  const initialSeverity = parseSeverityParam(searchParams?.get("severity") ?? null);

  const [me, setMe] = useState<Me | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  // 정책 메타 — 비정책 게시판에서는 사용하지 않음
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");           // "보안, PII, 적재"
  const [severity, setSeverity] = useState<Severity | "">(initialSeverity);
  const [appliesTo, setAppliesTo] = useState("");
  const [tldr, setTldr] = useState("");
  const [actionItemsText, setActionItemsText] = useState(""); // 줄당 1개
  const [examples, setExamples] = useState("");

  // 파일 첨부 (글 등록 후 순차 업로드)
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 예시 보기 모달
  const [exampleOpen, setExampleOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setMe);
  }, []);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const action_items = actionItemsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      setProgress("게시글 저장 중...");
      const post = await api.createPost(board, {
        title,
        category: category || undefined,
        content,
        ...(isPolicy && {
          summary: summary || null,
          tags: tags.length > 0 ? tags : null,
          severity: severity || null,
          applies_to: appliesTo || null,
          tldr: tldr || null,
          action_items: action_items.length > 0 ? action_items : null,
          examples: examples || null,
        }),
      });

      // 게시글 생성 후 파일 순차 업로드 — 일부 실패해도 계속 시도
      for (let i = 0; i < files.length; i++) {
        setProgress(`파일 업로드 중 (${i + 1}/${files.length}): ${files[i].name}`);
        try {
          await api.uploadPostAttachment(board, post.id, files[i]);
        } catch (e) {
          console.error(`업로드 실패 (${files[i].name}):`, e);
        }
      }

      router.push(`/governance/${boardSegment(board)}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">새 글 작성</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        {/* 기본 입력 */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-bold text-gray-700">기본 정보</h2>
          <div className="space-y-5">
            <Field label="제목" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="제목을 입력하세요"
                className={inputCls}
              />
            </Field>

            <Field label="카테고리" required>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">카테고리를 선택하세요</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="내용" required>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={8}
                placeholder="내용을 입력하세요"
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        {/* 정책 메타 — policy 게시판일 때만 노출 */}
        {isPolicy && (
          <section className="rounded-lg border border-blue-100 bg-blue-50/30 p-6">
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-sm font-bold text-blue-900">정책 메타데이터</h2>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">선택</span>
              <button
                type="button"
                onClick={() => setExampleOpen(true)}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                예시 보기
              </button>
            </div>
            <p className="mb-4 text-xs text-blue-800/70">
              정책을 읽는 사람이 빠르게 파악하고 행동으로 옮길 수 있도록 도와주는 정보입니다. 비워둔 항목은 화면에 표시되지 않습니다.
            </p>

            <div className="space-y-5">
              <Field label="한 줄 설명 (summary)" hint="목록 카드에 노출 — 무엇에 관한 정책인지 한 문장">
                <input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="예: 신규 데이터셋 등록 시 메타데이터·라이선스 검증을 필수화합니다."
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="중요도 (severity)" hint="목록에서 필터·뱃지로 사용">
                  <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setSeverity("")}
                      className={chipCls(severity === "")}
                    >
                      미지정
                    </button>
                    {SEVERITIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSeverity(s.value)}
                        className={chipCls(severity === s.value)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="태그 (tags)" hint="쉼표로 구분 — 예: 보안, PII, 적재">
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="보안, PII, 적재"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="적용 대상 (applies_to)" hint="누가 이 정책을 봐야 하는가 — 클릭 전 preview 로 사용">
                <input
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value)}
                  placeholder="예: 신규 데이터셋을 등록하는 모든 데이터 등록자"
                  className={inputCls}
                />
              </Field>

              <Field label="핵심 요약" hint="상세 페이지 최상단 빨간 배너 — '결국 무엇을 해야 하는가'">
                <textarea
                  value={tldr}
                  onChange={(e) => setTldr(e.target.value)}
                  rows={3}
                  placeholder="2~3문장으로 핵심을 요약. 예: 새 데이터셋을 등록하기 전에 라이선스·소유권·PII 여부를 확인하세요."
                  className={inputCls}
                />
              </Field>

              <Field label="해야 할 것 — 체크리스트 (action items)" hint="한 줄에 하나씩 입력 — 사용자가 체크하면서 따라가는 항목">
                <textarea
                  value={actionItemsText}
                  onChange={(e) => setActionItemsText(e.target.value)}
                  rows={5}
                  placeholder={"라이선스 명시 (CC-BY 등)\nPII 포함 여부 확인\n메타데이터 5종 입력\nCompliance 사인오프"}
                  className={inputCls + " font-mono text-[13px]"}
                />
              </Field>

              <Field label="예시 (examples)" hint="올바른/잘못된 사례 — 행동의 구체화">
                <textarea
                  value={examples}
                  onChange={(e) => setExamples(e.target.value)}
                  rows={4}
                  placeholder={"올바른 사례\n- 라이선스: CC-BY-4.0 명시, 출처 URL 첨부\n\n잘못된 사례\n- 라이선스 미기재"}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>
        )}

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
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>

      {/* 정책 게시판 한정 — 예시 보기 모달 (read-only).
          현재 폼의 severity 가 설정돼 있으면 그 탭을 기본으로, 아니면 url 의 severity, 둘 다 없으면 '필수'. */}
      {isPolicy && (
        <PolicyExampleModal
          open={exampleOpen}
          onClose={() => setExampleOpen(false)}
          defaultSeverity={(severity || initialSeverity || "required") as Severity}
        />
      )}
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
