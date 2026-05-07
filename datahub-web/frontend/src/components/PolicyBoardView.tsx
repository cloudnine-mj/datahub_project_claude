"use client";

/**
 * 정책 게시판 — 표(table) 형태 목록 + 페이지네이션 + 검색.
 * 사용자가 첨부한 자문 목록 화면 패턴을 차용.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Pencil, Search } from "lucide-react";
import { api, type Me, type PostListItem } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { SeverityBadge } from "./SeverityBadge";
import { EmptyState } from "./EmptyState";
import { formatDate } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 50, 100];

export function PolicyBoardView() {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1); // 1-based

  useEffect(() => {
    api.listPosts("policy").then(setPosts).catch(() => setPosts([]));
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const canWrite = me?.permissions.can_write_policy ?? false;

  // 검색 필터링 (제목·설명·태그·적용 대상). 클라이언트 사이드.
  const filtered = useMemo(() => {
    if (!posts) return null;
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => {
      const haystack = [p.title, p.summary ?? "", (p.tags ?? []).join(" "), p.applies_to ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, query]);

  // 검색·페이지 크기 바뀔 때 1페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const pageItems = useMemo(() => {
    if (!filtered) return null;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 관리 정책" },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">데이터 관리 정책</h1>

      {/* 가이드 배너 */}
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-4">
        <div className="flex items-start gap-3 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <p className="text-blue-800/80">
            이 페이지는 데이터의 <strong className="font-semibold">생성·저장·활용·폐기</strong> 까지의 기준을 정의합니다.
            필요한 정책을 확인하고 <strong className="font-semibold">바로 실행</strong>할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 상단 툴바 */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="appearance-none rounded-md border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-brand focus:outline-none"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}개씩 보기</option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 설명, 태그, 적용 대상으로 검색"
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none"
          />
        </div>

        {canWrite ? (
          <Link
            href="/governance/policy/new"
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
          >
            <Pencil size={14} /> 글쓰기
          </Link>
        ) : (
          <span
            className="ml-auto inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500"
            title="관리자 전용 — 권한이 없으면 글을 작성할 수 없습니다"
          >
            <Pencil size={14} /> 글쓰기
          </span>
        )}
      </div>

      {/* 표 */}
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500">
            <tr>
              <th className="px-5 py-3">정책명</th>
              <th className="w-32 px-5 py-3">작성자</th>
              <th className="w-40 px-5 py-3">카테고리</th>
              <th className="w-32 px-5 py-3">등록일</th>
              <th className="w-32 px-5 py-3">수정일</th>
              <th className="w-32 px-5 py-3">진행상태</th>
            </tr>
          </thead>
          <tbody>
            {pageItems === null ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">불러오는 중...</td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message={
                      posts && posts.length > 0
                        ? "검색 결과가 없습니다. 다른 키워드로 다시 시도해 보세요."
                        : "등록된 정책이 없습니다 — 곧 추가될 예정입니다."
                    }
                  />
                </td>
              </tr>
            ) : (
              pageItems.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/governance/policy/${p.id}`}
                      className="font-medium text-gray-900 hover:text-brand"
                    >
                      {p.title}
                    </Link>
                    {p.summary && (
                      <div className="mt-0.5 truncate text-xs text-gray-500">{p.summary}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{p.author_name}</td>
                  <td className="px-5 py-3">
                    {p.category ? (
                      <span className="text-gray-700">{p.category}</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.created_at)}</td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(p.updated_at)}</td>
                  <td className="px-5 py-3">
                    {p.severity ? (
                      <SeverityBadge severity={p.severity} />
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 + 합계 */}
      {pageItems && pageItems.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">총 {filtered?.length ?? 0} 건</span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (n: number) => void;
}) {
  if (totalPages <= 1) return null;

  // 표시할 페이지 번호 — 현재 페이지 주변 + 처음/끝
  const pages: (number | "...")[] = [];
  const window = 1;
  pages.push(1);
  if (page - window > 2) pages.push("...");
  for (let i = Math.max(2, page - window); i <= Math.min(totalPages - 1, page + window); i++) {
    pages.push(i);
  }
  if (page + window < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        aria-label="이전 페이지"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`gap-${i}`} className="px-2 text-xs text-gray-400">...</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={
              "min-w-[28px] rounded px-2 py-1 text-xs font-semibold transition " +
              (p === page ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100")
            }
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        aria-label="다음 페이지"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
