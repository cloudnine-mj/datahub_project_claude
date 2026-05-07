"use client";

// 게시글 상세 — 화면 캡처에는 명시적 디자인 없으나 자연스러운 read-only 뷰.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { api, type BoardType, type Me, type PostDetail } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { DeletePostButton } from "./DeletePostButton";
import { BOARD_LABELS, formatDate } from "@/lib/utils";
import { boardSegment } from "./BoardListView";

export function PostDetailView({ board, postId }: { board: BoardType; postId: number }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPost(board, postId).then(setPost).catch((e) => setError((e as Error).message));
    api.me().then(setMe).catch(() => setMe(null));
  }, [board, postId]);

  const label = BOARD_LABELS[board];
  const canDelete = !!post && !!me && (me.user.role === "admin" || me.user.name === post.author_name);
  // 수정은 정책 게시판만, 어드민 한정.
  const canEdit = !!post && !!me && board === "policy" && me.user.role === "admin";

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
              {canEdit && (
                <Link
                  href={`/governance/${boardSegment(board)}/new?id=${post.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                >
                  <Pencil size={12} /> 수정
                </Link>
              )}
              {canDelete && (
                <DeletePostButton
                  board={board}
                  postId={post.id}
                  redirectTo={`/governance/${boardSegment(board)}`}
                />
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{post.content}</div>

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
    </div>
  );
}
