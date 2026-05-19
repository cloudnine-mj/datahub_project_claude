/**
 * Governance 게시판 목록 — policy / process 보드 공용.
 *
 * datahub-web `BoardListView` 의 컴팩트 재작성 — Sidebar 의존 제거 + datahub-develop
 * UI primitives 사용. 검색 / 카테고리 필터 / admin 상태 필터 / 페이지네이션.
 *
 * 프로세스 보드는 최근 사용자 요청에 따라 '태그' 컬럼 / 검색 / 입력 모두 제거.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, Pin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { governanceApi, type GovernancePostItem } from "@/lib/governance/api-client";
import { api as fullApi } from "@/lib/governance/api-client-full";

interface Props {
  board: "policy" | "process";
}

const PAGE_SIZES = [5, 10, 20, 50] as const;

const PROCESS_CATEGORIES = ["제작 프로세스", "활용 요청 프로세스"] as const;

export function BoardList({ board }: Props) {
  const [posts, setPosts] = useState<GovernancePostItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(
    () => new Set(PROCESS_CATEGORIES),
  );
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [canWrite, setCanWrite] = useState(false);

  const isProcess = board === "process";

  useEffect(() => {
    let cancelled = false;
    governanceApi
      .listPosts(board)
      .then((rows) => {
        if (!cancelled) setPosts(rows);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    // 게시판 작성 권한 — admin 만. me 응답의 permissions.can_write_{board} 사용.
    fullApi
      .me()
      .then((m) => {
        if (cancelled) return;
        setCanWrite(
          board === "policy" ? !!m.permissions.can_write_policy : !!m.permissions.can_write_process,
        );
      })
      .catch(() => {
        /* 미인증/관리자 아님 — 작성 버튼 숨김 */
      });
    return () => {
      cancelled = true;
    };
  }, [board]);

  const filtered = useMemo(() => {
    if (!posts) return [];
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (isProcess && p.category && !categoryFilter.has(p.category)) return false;
      if (!q) return true;
      const hay = [
        p.title,
        p.authorName,
        p.docType ?? "",
        p.category ?? "",
        // 정책 보드만 태그 검색 포함 (프로세스는 태그 사용 안 함)
        ...(!isProcess && p.tags ? p.tags : []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [posts, query, categoryFilter, isProcess]);

  // 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, pageSize, board]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="h-9 rounded-md border border-dh-border bg-white px-3 text-sm"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}개씩 보기
            </option>
          ))}
        </select>

        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isProcess
                ? "제목, 작성자, 유형, 카테고리로 검색"
                : "제목, 작성자, 유형, 카테고리, 태그로 검색"
            }
            className="h-9 w-full pl-9"
          />
        </div>

        {isProcess && (
          <div className="flex items-center gap-1.5">
            {PROCESS_CATEGORIES.map((c) => {
              const active = categoryFilter.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const next = new Set(categoryFilter);
                    if (active) next.delete(c);
                    else next.add(c);
                    setCategoryFilter(next);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-dh-border bg-white text-text-secondary hover:bg-bg-surface"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {/* 작성하기 — admin 만 노출. 미인증/일반 사용자는 안 보임. */}
        {canWrite && (
          <Link
            href={`/governance/${board}/new`}
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
          >
            <Pencil className="h-3.5 w-3.5" />
            작성하기
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-dh-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="w-16 px-4 py-3">번호</th>
              <th className="px-4 py-3">문서명</th>
              {isProcess && <th className="w-40 px-4 py-3">카테고리</th>}
              <th className="w-32 px-4 py-3">작성자</th>
              <th className="w-32 px-4 py-3 text-right">작성일</th>
              <th className="w-32 px-4 py-3 text-right">수정일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dh-border">
            {posts === null ? (
              <tr>
                <td colSpan={isProcess ? 6 : 5} className="px-4 py-12 text-center text-sm text-text-muted">
                  불러오는 중...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={isProcess ? 6 : 5} className="px-4 py-12 text-center text-sm text-text-muted">
                  {posts.length === 0 ? "등록된 문서가 없습니다" : "검색·필터 결과가 없습니다."}
                </td>
              </tr>
            ) : (
              pageItems.map((p, i) => {
                const indexInFiltered = (page - 1) * pageSize + i;
                const totalRows = filtered.length;
                return (
                  <tr key={p.id} className="hover:bg-bg-surface/50 transition-colors">
                    <td className="px-4 py-3 text-text-muted">{totalRows - indexInFiltered}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/governance/${board}/${p.id}`}
                        className="inline-flex items-center gap-2 font-medium text-text-primary hover:text-brand"
                      >
                        {p.pinned && (
                          <Pin className="h-3 w-3 shrink-0 text-amber-600" aria-label="상단 고정" />
                        )}
                        {p.isDraft && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-700">
                            임시 저장
                          </span>
                        )}
                        {p.docType && (
                          <span className="rounded-full border border-dh-border bg-bg-surface px-1.5 py-0 text-[10px] text-text-secondary">
                            {p.docType}
                          </span>
                        )}
                        <span>{p.title}</span>
                      </Link>
                    </td>
                    {isProcess && (
                      <td className="px-4 py-3">
                        {p.category ? (
                          <span className="inline-flex rounded-full border border-dh-border bg-bg-surface px-2 py-0.5 text-[11px] text-text-secondary">
                            {p.category}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-text-secondary">{p.authorName}</td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {new Date(p.updatedAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
          <span>총 {filtered.length}건</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-dh-border bg-white p-1 text-text-secondary disabled:opacity-40 hover:bg-bg-surface"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-dh-border bg-white p-1 text-text-secondary disabled:opacity-40 hover:bg-bg-surface"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
