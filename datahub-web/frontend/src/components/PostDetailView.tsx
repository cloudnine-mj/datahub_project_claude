"use client";

// 게시글 상세 — 화면 캡처에는 명시적 디자인 없으나 자연스러운 read-only 뷰.
import { useEffect, useState } from "react";
import { api, type BoardType, type PostDetail } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { BOARD_LABELS, formatDate } from "@/lib/utils";
import { boardSegment } from "./BoardListView";

export function PostDetailView({ board, postId }: { board: BoardType; postId: number }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPost(board, postId).then(setPost).catch((e) => setError((e as Error).message));
  }, [board, postId]);

  const label = BOARD_LABELS[board];

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
          <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            {post.category && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">{post.category}</span>
            )}
            <span>{post.author_name}</span>
            <span>·</span>
            <span>{formatDate(post.created_at)}</span>
          </div>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{post.content}</div>
        </div>
      )}
    </div>
  );
}
