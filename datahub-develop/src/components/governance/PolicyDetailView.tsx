"use client";

/**
 * 정책 상세 — 첨부 이미지의 일반 게시글 상세와 동일한 단순 레이아웃.
 *
 *  ┌─ Card ──────────────────────────────┐
 *  │ 제목                  [수정][삭제]    │
 *  │ 필수 #보안 · 작성자 · 등록일          │
 *  │ ──────                                │
 *  │ Markdown 본문                         │
 *  │                                       │
 *  │ 첨부 파일                             │
 *  └───────────────────────────────────────┘
 *
 * 이전 버전의 핵심 요약 / 체크리스트 / 예시 / 적용 대상 / summary 섹션은 제거.
 * (마크다운 본문 안에 자유롭게 작성)
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, Pencil, Pin, PinOff, X } from "lucide-react";
import { api, type Me, type PostDetail } from "@/lib/governance/api-client-full";
import { Breadcrumb } from "./Breadcrumb";
import { MarkdownView } from "./MarkdownEditor";
import { DeletePostButton } from "./DeletePostButton";
import { DOC_TYPE_STYLES, formatDate } from "@/lib/governance/forms/utils-bridge";

export function PolicyDetailView({ postId }: { postId: string | number }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbiddenOpen, setForbiddenOpen] = useState(false);
  const [pinning, setPinning] = useState(false);
  const searchParams = useSearchParams();
  // 관리 그룹(?manage=1) 진입 — platform role 무관 상단고정/수정/삭제 노출.
  const isManageView = searchParams?.get("manage") === "1";

  useEffect(() => {
    api.getPost("policy", postId).then(setPost).catch((e) => setError((e as Error).message));
    api.me().then(setMe).catch(() => setMe(null));
  }, [postId]);

  if (error) return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!post) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  const isAdmin = me?.user.role === "admin";
  // 삭제 권한: 관리 그룹 진입이거나 admin 이거나 작성자 본인. 백엔드도 동일하게 검증함.
  const canDelete = isManageView || (!!me && (isAdmin || me.user.name === post.author_name));
  const showAdminActions = isManageView || isAdmin;

  async function togglePin() {
    if (!post || pinning) return;
    setPinning(true);
    try {
      const updated = await api.togglePinPost("policy", post.id);
      setPost(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPinning(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 거버넌스 정책", href: "/governance/policy" },
          { label: post.title },
        ]}
      />

      <div className="mt-2 rounded-lg border border-gray-200 bg-white p-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 flex-1 text-2xl font-bold tracking-tight">{post.title}</h1>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* 상단 고정 토글 — 관리 그룹 진입 또는 admin. 고정 상태면 PinOff 아이콘 + amber 톤. */}
            {showAdminActions && (
              <button
                type="button"
                onClick={togglePin}
                disabled={pinning}
                className={
                  "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 " +
                  (post.pinned
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50")
                }
                title={post.pinned ? "상단 고정 해제" : "상단에 고정"}
              >
                {post.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                {post.pinned ? "고정 해제" : "상단 고정"}
              </button>
            )}
            {showAdminActions ? (
              <Link
                href={`/governance/policy/new?id=${post.id}${isManageView ? "&manage=1" : ""}`}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
              >
                <Pencil size={12} /> 수정
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setForbiddenOpen(true)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
              >
                <Pencil size={12} /> 수정
              </button>
            )}
            {canDelete && (
              <DeletePostButton board="policy" postId={post.id} redirectTo={`/governance/policy${isManageView ? "?manage=1" : ""}`} />
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              <Pin size={10} /> 상단 고정
            </span>
          )}
          {post.is_draft && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              임시저장
            </span>
          )}
          {post.doc_type && (() => {
            const s = DOC_TYPE_STYLES[post.doc_type] ?? {
              pill: "bg-gray-50 text-gray-700 border-gray-200",
              dot: "bg-gray-400",
            };
            return (
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.pill}`}>
                {post.doc_type}
              </span>
            );
          })()}
          {(post.tags ?? []).map((t) => (
            <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
              #{t}
            </span>
          ))}
          <span>{post.author_name}</span>
          <span>·</span>
          <span>{formatDate(post.created_at)}</span>
        </div>

        {post.content && (
          <div className="mt-6">
            <MarkdownView source={post.content} />
          </div>
        )}

        {post.attachments.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <h3 className="mb-2 text-sm font-bold">첨부 파일 ({post.attachments.length})</h3>
            <ul className="space-y-1.5">
              {post.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-gray-400">📎</span>
                    <span className="truncate">{a.filename}</span>
                    <span className="shrink-0 text-xs text-gray-400">
                      ({Math.round(a.size_bytes / 1024)} KB)
                    </span>
                  </div>
                  <a
                    href={api.postAttachmentUrl("policy", post.id, a.id)}
                    className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    다운로드
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 목록으로 돌아가기 */}
      {post && (
        <div className="mt-4 flex justify-end">
          <Link
            href={`/governance/policy${isManageView ? "?manage=1" : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            <ArrowLeft size={14} /> 데이터 거버넌스 정책
          </Link>
        </div>
      )}

      {forbiddenOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setForbiddenOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-red-500">
                  <Lock size={18} />
                </span>
                <h3 className="text-base font-bold">수정 권한 없음</h3>
              </div>
              <button
                type="button"
                onClick={() => setForbiddenOpen(false)}
                aria-label="닫기"
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              데이터 거버넌스 정책 문서는 <strong className="font-semibold text-gray-800">관리자</strong>만 수정할 수 있습니다. 수정이 필요하면 거버넌스 관리자에게 요청해 주세요.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setForbiddenOpen(false)}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
