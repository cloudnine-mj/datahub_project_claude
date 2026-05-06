"use client";

// 화면 2,3,4 의 게시판 목록 뷰 — 단일 컴포넌트로 3개 게시판 모두 처리.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { api, type BoardType, type Me, type PostListItem } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { EmptyState } from "./EmptyState";
import { BOARD_LABELS, formatDate } from "@/lib/utils";

interface Props {
  board: BoardType;
}

export function BoardListView({ board }: Props) {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.listPosts(board).then(setPosts).catch(() => setPosts([]));
    api.me().then(setMe).catch(() => setMe(null));
  }, [board]);

  const canWrite = me?.permissions[`can_write_${board}` as const] ?? false;
  const label = BOARD_LABELS[board];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{label}</h1>

      <div className="mt-8 flex justify-end">
        {canWrite ? (
          <Link
            href={`/governance/${boardSegment(board)}/new`}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
          >
            <Pencil size={14} /> 글쓰기
          </Link>
        ) : (
          <span
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500"
            title="관리자 전용 — 권한이 없으면 글을 작성할 수 없습니다"
          >
            <Pencil size={14} /> 글쓰기
          </span>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="w-24 px-6 py-3 font-medium">번호</th>
              <th className="px-6 py-3 font-medium">제목</th>
              <th className="w-40 px-6 py-3 text-right font-medium">작성일</th>
            </tr>
          </thead>
          <tbody>
            {posts === null ? (
              <tr>
                <td colSpan={3} className="px-6 py-16 text-center text-gray-400">불러오는 중...</td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <EmptyState message="등록된 문서가 없습니다" />
                </td>
              </tr>
            ) : (
              posts.map((p, i) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-400">{posts.length - i}</td>
                  <td className="px-6 py-4">
                    <Link href={`/governance/${boardSegment(board)}/${p.id}`} className="font-medium hover:text-brand">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-400">{formatDate(p.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function boardSegment(board: BoardType): string {
  return board === "policy" ? "policy" : board === "production_process" ? "process/production" : "process/usage";
}
