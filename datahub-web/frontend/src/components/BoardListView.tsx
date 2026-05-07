"use client";

/**
 * 게시판 목록 뷰 — 정책 / 통합 프로세스 게시판 공용.
 *
 *  - process 보드는 카테고리(제작 / 활용 요청) 필터 칩 노출.
 *  - 정책 보드는 PolicyBoardView 를 별도 사용 (이 컴포넌트는 process 가 메인 사용처).
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { api, type BoardType, type Me, type PostListItem } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { EmptyState } from "./EmptyState";
import { BOARD_LABELS, PROCESS_CATEGORIES, formatDate } from "@/lib/utils";

interface Props {
  board: BoardType;
}

type CategoryFilter = "all" | (typeof PROCESS_CATEGORIES)[number];

export function BoardListView({ board }: Props) {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");

  useEffect(() => {
    api.listPosts(board).then(setPosts).catch(() => setPosts([]));
    api.me().then(setMe).catch(() => setMe(null));
  }, [board]);

  const canWrite = me?.permissions[`can_write_${board}` as const] ?? false;
  const label = BOARD_LABELS[board];
  const isProcess = board === "process";

  const filtered = useMemo(() => {
    if (!posts) return null;
    if (!isProcess || filter === "all") return posts;
    return posts.filter((p) => p.category === filter);
  }, [posts, filter, isProcess]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts?.length ?? 0 };
    for (const p of posts ?? []) {
      if (p.category) c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return c;
  }, [posts]);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">{label}</h1>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {isProcess && (
          <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              전체 {counts.all > 0 && <span className="ml-1 text-gray-400">({counts.all})</span>}
            </FilterChip>
            {PROCESS_CATEGORIES.map((c) => (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
                {c}
                {(counts[c] ?? 0) > 0 && (
                  <span className="ml-1 text-gray-400">({counts[c]})</span>
                )}
              </FilterChip>
            ))}
          </div>
        )}

        <div className="ml-auto">
          {canWrite ? (
            <Link
              href={`/governance/${boardSegment(board)}/new`}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
            >
              <Pencil size={14} /> 작성하기
            </Link>
          ) : (
            <span
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500"
              title="관리자 전용 — 권한이 없으면 글을 작성할 수 없습니다"
            >
              <Pencil size={14} /> 작성하기
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="w-24 px-6 py-3 font-medium">번호</th>
              <th className="px-6 py-3 font-medium">제목</th>
              {isProcess && <th className="w-40 px-6 py-3 font-medium">카테고리</th>}
              <th className="w-40 px-6 py-3 text-right font-medium">작성일</th>
            </tr>
          </thead>
          <tbody>
            {filtered === null ? (
              <tr>
                <td colSpan={isProcess ? 4 : 3} className="px-6 py-16 text-center text-gray-400">
                  불러오는 중...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={isProcess ? 4 : 3}>
                  <EmptyState
                    message={
                      posts && posts.length > 0
                        ? "선택한 카테고리에 해당하는 문서가 없습니다."
                        : "등록된 문서가 없습니다"
                    }
                  />
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-400">{filtered.length - i}</td>
                  <td className="px-6 py-4">
                    <Link href={`/governance/${boardSegment(board)}/${p.id}`} className="font-medium hover:text-brand">
                      {p.title}
                    </Link>
                  </td>
                  {isProcess && (
                    <td className="px-6 py-4">
                      {p.category ? (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {p.category}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  )}
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded px-3 py-1.5 text-xs font-semibold transition " +
        (active ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100")
      }
    >
      {children}
    </button>
  );
}

export function boardSegment(board: BoardType): string {
  return board === "policy" ? "policy" : "process";
}
