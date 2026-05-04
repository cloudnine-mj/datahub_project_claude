"use client";

// 화면 7: 새 글 작성 폼.
//
// 정책 게시판(policy)일 때는 추가 메타필드(summary/tags/severity/applies_to/tldr/
// action_items/examples) 입력 영역이 같이 보임. 다른 게시판은 단순 폼 그대로.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { api, type BoardType, type Me, type Severity } from "@/lib/api";
import { boardSegment } from "./BoardListView";
import { SEVERITIES } from "./SeverityBadge";

const CATEGORIES = ["가이드", "공지", "정책", "FAQ"];

export function PostNewView({ board }: { board: BoardType }) {
  const router = useRouter();
  const isPolicy = board === "policy";

  const [me, setMe] = useState<Me | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  // 정책 메타 — 비정책 게시판에서는 사용하지 않음
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");           // "보안, PII, 적재"
  const [severity, setSeverity] = useState<Severity | "">("");
  const [appliesTo, setAppliesTo] = useState("");
  const [tldr, setTldr] = useState("");
  const [actionItemsText, setActionItemsText] = useState(""); // 줄당 1개
  const [examples, setExamples] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setMe);
  }, []);

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

      await api.createPost(board, {
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
      router.push(`/governance/${boardSegment(board)}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
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

            <Field label="카테고리">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
            </div>
            <p className="mb-4 text-xs text-blue-800/70">
              사용자가 정책을 빠르게 파악하고 행동으로 옮길 수 있도록 도와주는 정보입니다. 비워두면 단순 게시글로 표시됩니다.
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

              <Field label="TL;DR (요약)" hint="상세 페이지 최상단 빨간 배너 — '결국 무엇을 해야 하는가'">
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
                  placeholder={"✅ 올바른 사례\n- 라이선스: CC-BY-4.0 명시, 출처 URL 첨부\n\n❌ 잘못된 사례\n- 라이선스 미기재"}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>
        )}

        {/* 첨부 (TODO: 게시글 업로드 연동은 다음 단계) */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-400">
            <Paperclip size={14} />
            파일 첨부 (다음 단계에서 연동 예정)
          </div>
        </section>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

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
