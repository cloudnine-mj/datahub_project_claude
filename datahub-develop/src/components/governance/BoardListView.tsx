"use client";

/**
 * 게시판 목록 뷰 — 정책 / 통합 프로세스 게시판 공용.
 *
 *  - process 보드는 카테고리(제작 / 활용 요청) 필터 칩 노출.
 *  - 정책 보드는 PolicyBoardView 를 별도 사용 (이 컴포넌트는 process 가 메인 사용처).
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Pin, Search } from "lucide-react";
import { api, type BoardType, type Me, type PostListItem } from "@/lib/governance/api-client-full";
import { Breadcrumb } from "./Breadcrumb";
import { EmptyState } from "./EmptyState";
import { BOARD_LABELS, PROCESS_CATEGORIES, formatDate } from "@/lib/governance/forms/utils-bridge";
import { DocTypePill } from "./DocTypePill";

const PAGE_SIZES = [5, 10, 20, 50, 100];

interface Props {
  board: BoardType;
  /** true 면 자체 Breadcrumb·페이지 제목 생략 — 상위 컨테이너가 헤더를 책임지는 임베드 모드. */
  compact?: boolean;
}

type CategoryKey = (typeof PROCESS_CATEGORIES)[number];

// admin 게시글 상태 필터 — 임시 저장 / 게시됨.
// PolicyBoardView 와 동일 — 별도 '게시글 관리' 페이지를 대체하기 위해 여기도 노출.
type PostStatusKey = "draft" | "published";
const POST_STATUS_OPTIONS: { key: PostStatusKey; label: string }[] = [
  { key: "draft", label: "임시 저장" },
  { key: "published", label: "게시됨" },
];

function postStatusKey(p: PostListItem): PostStatusKey {
  return p.is_draft ? "draft" : "published";
}

// 카테고리별 색 — 칩(active)과 표 배지에 공통 사용
const CATEGORY_COLORS: Record<
  string,
  { chipActive: string; pill: string; dot: string; label: string }
> = {
  "제작 프로세스": {
    chipActive: "bg-blue-500 text-white",
    pill: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    label: "제작 프로세스",
  },
  "활용 요청 프로세스": {
    chipActive: "bg-emerald-500 text-white",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    label: "활용 요청 프로세스",
  },
};

export function BoardListView({ board, compact = false }: Props) {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  // 카테고리 다중 필터 — 기본은 전체 선택 (Policy 의 severity 필터와 동일 패턴)
  const [categoryFilter, setCategoryFilter] = useState<Set<CategoryKey>>(
    () => new Set(PROCESS_CATEGORIES),
  );
  // admin 전용 게시글 상태 필터 — 기본 전체 선택
  const [statusFilter, setStatusFilter] = useState<Set<PostStatusKey>>(
    () => new Set(POST_STATUS_OPTIONS.map((o) => o.key)),
  );
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.listPosts(board).then(setPosts).catch(() => setPosts([]));
    api.me().then(setMe).catch(() => setMe(null));
  }, [board]);

  const canWrite = me?.permissions[`can_write_${board}` as const] ?? false;
  const isAdmin = me?.user.role === "admin";
  const label = BOARD_LABELS[board];
  const isProcess = board === "process";

  // 카테고리 필터 + (admin) 상태 필터 + 검색 (제목 / 작성자 / 유형 / 카테고리). 클라이언트 사이드.
  const filtered = useMemo(() => {
    if (!posts) return null;
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      // 카테고리 필터: category 가 있으면 set 매칭, 없으면 통과 (옛 데이터 호환)
      if (isProcess && p.category && !categoryFilter.has(p.category as CategoryKey)) return false;
      // admin 상태 필터
      if (isAdmin && !statusFilter.has(postStatusKey(p))) return false;
      if (!q) return true;
      const haystack = [
        p.title,
        p.author_name,
        p.doc_type ?? "",
        p.category ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, categoryFilter, isProcess, isAdmin, statusFilter, query]);

  // 필터/검색/페이지 크기 바뀔 때 첫 페이지로 리셋
  useEffect(() => {
    setPage(1);
  }, [categoryFilter, statusFilter, query, pageSize]);

  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const pageItems = useMemo(() => {
    if (!filtered) return null;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div>
      {!compact && (
        <>
          <Breadcrumb
            items={[
              { label: "Governance", href: "/governance" },
              { label },
            ]}
          />
          <h1 className="text-3xl font-bold tracking-tight">{label}</h1>
        </>
      )}

      <div className={(compact ? "" : "mt-8 ") + "flex flex-wrap items-center gap-3"}>
        {/* 페이지 크기 선택 */}
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

        {/* 검색 */}
        <div className="relative min-w-[220px] max-w-md flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 작성자, 유형, 카테고리로 검색"
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none"
          />
        </div>

        {isProcess && (
          <CategoryFilterDropdown selected={categoryFilter} onChange={setCategoryFilter} />
        )}

        {/* 게시글 상태 필터 — admin 만 노출 (임시 저장 / 게시됨). */}
        {isAdmin && (
          <PostStatusFilterDropdown selected={statusFilter} onChange={setStatusFilter} />
        )}

        {/* 작성하기 — admin 만 노출. 권한 없는 사용자는 버튼 자체가 안 보임. */}
        {canWrite && (
          <div className="ml-auto">
            <Link
              href={`/governance/${boardSegment(board)}/new`}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
            >
              <Pencil size={14} /> 작성하기
            </Link>
          </div>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="w-24 px-6 py-3 font-medium">번호</th>
              <th className="px-6 py-3 font-medium">문서명</th>
              {isProcess && <th className="w-40 px-6 py-3 font-medium">카테고리</th>}
              <th className="w-32 px-6 py-3 font-medium">작성자</th>
              <th className="w-40 px-6 py-3 text-right font-medium">작성일</th>
              <th className="w-40 px-6 py-3 text-right font-medium">수정일</th>
            </tr>
          </thead>
          <tbody>
            {pageItems === null ? (
              <tr>
                <td colSpan={isProcess ? 6 : 5} className="px-6 py-16 text-center text-gray-400">
                  불러오는 중...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={isProcess ? 6 : 5}>
                  <EmptyState
                    message={
                      posts && posts.length > 0
                        ? "검색·필터 결과가 없습니다."
                        : "등록된 문서가 없습니다"
                    }
                  />
                </td>
              </tr>
            ) : (
              pageItems.map((p, i) => {
                // 전체 정렬 기준 번호 — filtered 전체에서 역순으로 매김
                const indexInFiltered = (page - 1) * pageSize + i;
                const totalRows = filtered?.length ?? 0;
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-400">{totalRows - indexInFiltered}</td>
                    <td className="px-6 py-4">
                      <Link href={`/governance/${boardSegment(board)}/${p.id}`} className="inline-flex items-center gap-2 font-medium hover:text-brand">
                        {p.pinned && (
                          <Pin size={12} className="shrink-0 text-amber-600" aria-label="상단 고정" />
                        )}
                        {p.is_draft && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-700">
                            임시 저장
                          </span>
                        )}
                        {p.doc_type && <DocTypePill docType={p.doc_type} />}
                        <span>{p.title}</span>
                      </Link>
                    </td>
                    {isProcess && (
                      <td className="px-6 py-4">
                        {p.category ? (
                          <CategoryPill category={p.category} />
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-gray-600">{p.author_name}</td>
                    <td className="px-6 py-4 text-right text-gray-400">{formatDate(p.created_at)}</td>
                    <td className="px-6 py-4 text-right text-gray-400">{formatDate(p.updated_at)}</td>
                  </tr>
                );
              })
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

/**
 * 카테고리 필터 드롭다운 — 체크된 카테고리 row 만 표시. 외부 클릭 자동 닫힘.
 * Policy 보드의 SeverityFilterDropdown 와 동일 패턴.
 */
function CategoryFilterDropdown({
  selected,
  onChange,
}: {
  selected: Set<CategoryKey>;
  onChange: (next: Set<CategoryKey>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle(key: CategoryKey) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(PROCESS_CATEGORIES));
  }

  const isAll = selected.size === PROCESS_CATEGORIES.length;
  const summary = isAll
    ? "카테고리: 전체"
    : selected.size === 0
    ? "카테고리: 없음"
    : "카테고리: " + PROCESS_CATEGORIES.filter((c) => selected.has(c)).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[260px] items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-bold text-gray-700">카테고리 필터</span>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              전체 선택
            </button>
          </div>
          <ul>
            {PROCESS_CATEGORIES.map((c) => {
              const checked = selected.has(c);
              return (
                <li key={c}>
                  <label
                    className={
                      "flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm " +
                      (checked ? "bg-blue-50/50 font-semibold text-blue-700" : "hover:bg-gray-50")
                    }
                  >
                    <span>{c}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(c)}
                      className="h-4 w-4 rounded text-blue-500 focus:ring-blue-500"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 카테고리별 색을 가진 pill — 정책 보드의 SeverityBadge 와 같은 룩. */
function CategoryPill({ category }: { category: string }) {
  const c = CATEGORY_COLORS[category];
  if (!c) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600">
        {category}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${c.pill}`}>
      {c.label}
    </span>
  );
}

export function boardSegment(board: BoardType): string {
  return board === "policy" ? "policy" : "process";
}

/** 게시글 상태 다중 선택 드롭다운 — admin 이 임시 저장 / 게시됨을 골라 볼 때 사용. */
function PostStatusFilterDropdown({
  selected,
  onChange,
}: {
  selected: Set<PostStatusKey>;
  onChange: (next: Set<PostStatusKey>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle(key: PostStatusKey) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(POST_STATUS_OPTIONS.map((o) => o.key)));
  }

  const isAll = selected.size === POST_STATUS_OPTIONS.length;
  const summary = isAll
    ? "상태: 전체"
    : selected.size === 0
    ? "상태: 없음"
    : "상태: " + POST_STATUS_OPTIONS.filter((o) => selected.has(o.key)).map((o) => o.label).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[260px] items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-bold text-gray-700">상태 필터</span>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              전체 선택
            </button>
          </div>
          <ul>
            {POST_STATUS_OPTIONS.map((o) => {
              const checked = selected.has(o.key);
              return (
                <li key={o.key}>
                  <label
                    className={
                      "flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm " +
                      (checked ? "bg-blue-50/50 font-semibold text-blue-700" : "hover:bg-gray-50")
                    }
                  >
                    <span>{o.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.key)}
                      className="h-4 w-4 rounded text-blue-500 focus:ring-blue-500"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
