"use client";

// 게시글 상세 — 화면 캡처에는 명시적 디자인 없으나 자연스러운 read-only 뷰.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Pencil, Pin, PinOff } from "lucide-react";
import { api, type BoardType, type Me, type PostDetail } from "@/lib/governance/api-client-full";
import { Breadcrumb } from "./Breadcrumb";
import { DeletePostButton } from "./DeletePostButton";
import { MarkdownView } from "./MarkdownEditor";
import { BOARD_LABELS, DOC_TYPE_STYLES, formatDate } from "@/lib/governance/forms/utils-bridge";
import { boardSegment } from "./BoardListView";

export function PostDetailView({ board, postId }: { board: BoardType; postId: string | number }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const searchParams = useSearchParams();
  // 관리 그룹(?manage=1) 진입 — platform role 무관 관리자 액션(상단고정/수정/삭제) 노출.
  // 가이드 그룹(?manage 없음) 진입은 read-only.
  const isManageView = searchParams?.get("manage") === "1";

  useEffect(() => {
    api.getPost(board, postId).then(setPost).catch((e) => setError((e as Error).message));
    api.me().then(setMe).catch(() => setMe(null));
  }, [board, postId]);

  const label = BOARD_LABELS[board];
  const isAdmin = me?.user.role === "admin";
  const canDelete = !!post && (isManageView || (!!me && (isAdmin || me.user.name === post.author_name)));
  // 수정 / 상단고정: 관리 그룹 진입이거나 admin 일 때 노출.
  const showAdminActions = !!post && (isManageView || isAdmin);

  async function togglePin() {
    if (!post || pinning) return;
    setPinning(true);
    try {
      const updated = await api.togglePinPost(board, post.id);
      setPost(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPinning(false);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label, href: `/governance/${boardSegment(board)}` },
          { label: post?.title ?? "..." },
        ]}
      />
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {post && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white p-8">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
            <div className="flex items-center gap-1.5">
              {/* 상단 고정 토글 — 관리 그룹 진입 또는 admin. 고정 상태면 PinOff 아이콘 + 활성 톤. */}
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
              {showAdminActions && (
                <Link
                  href={`/governance/${boardSegment(board)}/new?id=${post.id}${isManageView ? "&manage=1" : ""}`}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                >
                  <Pencil size={12} /> 수정
                </Link>
              )}
              {canDelete && (
                <DeletePostButton
                  board={board}
                  postId={post.id}
                  redirectTo={`/governance/${boardSegment(board)}${isManageView ? "?manage=1" : ""}`}
                />
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
                임시 저장
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
            {post.doc_no && (
              <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-blue-700">
                {post.doc_no}
              </span>
            )}
            {post.category && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">{post.category}</span>
            )}
            <span>{post.author_name}</span>
            <span>·</span>
            <span>{formatDate(post.created_at)}</span>
          </div>
          <div className="mt-6">
            <MarkdownView source={post.content} />
          </div>

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
                      href={api.postAttachmentUrl(board, post.id, a.id)}
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
      )}

      {/* 목록으로 돌아가기 */}
      {post && (
        <div className="mt-4 flex justify-end">
          <Link
            href={`/governance/${board}${isManageView ? "?manage=1" : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            <ArrowLeft size={14} /> {label}
          </Link>
        </div>
      )}
    </div>
  );
}
