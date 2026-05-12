"use client";

// 내 문서 목록 —
//   admin: 본인이 작성한 정책/프로세스 게시글 (공개 + 임시저장)
//   non-admin: 본인이 제출한 신청서 목록
// role 에 따라 한쪽만 노출. admin 은 신청서를 작성할 일이 거의 없고, non-admin 은
// 정책/프로세스 글쓰기 권한 자체가 없으므로 양쪽 모두 한쪽만 의미 있음.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Pencil, Search } from "lucide-react";
import {
  api,
  type BoardType,
  type FormListItem,
  type FormStatus,
  type Me,
  type PostListItem,
} from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteFormButton } from "@/components/DeleteFormButton";
import { DeletePostButton } from "@/components/DeletePostButton";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import { boardSegment } from "@/components/BoardListView";
import { BOARD_LABELS, FORM_TYPE_LABELS, formatDateTime, parseUtc } from "@/lib/utils";

type StatusFilter = "all" | FormStatus;
type MyPost = PostListItem & { board: BoardType };

const PAGE_SIZES = [10, 20, 50, 100];

type PostStatusKey = "draft" | "private" | "published";

const POST_STATUS_OPTIONS: { key: PostStatusKey; label: string }[] = [
  { key: "draft", label: "임시저장" },
  { key: "private", label: "비공개" },
  { key: "published", label: "게시됨" },
];

function postStatusKey(p: MyPost): PostStatusKey {
  if (p.is_draft) return "draft";
  if (p.visibility === "admin") return "private";
  return "published";
}

/** 게시글 상태 (임시저장 / 비공개 / 게시됨) 를 검색 매칭용 문자열로. */
function postStatusLabel(p: MyPost): string {
  return POST_STATUS_OPTIONS.find((o) => o.key === postStatusKey(p))?.label ?? "";
}

/** '-vN' 접미사를 제거한 base request_no. 그룹 키로 사용. */
function getBaseRequestNo(rn: string): string {
  return rn.replace(/-v\d+$/, "");
}

/** 그룹 내 '가장 최신 버전' 판정. 상태 확정도 우선, 동률이면 시각 역순. */
function statusPriority(status: string): number {
  if (status === "approved" || status === "rejected") return 4;
  if (status === "reviewing") return 3;
  if (status === "submitted") return 2;
  return 1; // draft
}

export default function MyDocumentsPage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  // me 응답을 기다리는 동안 페이지 헤더만 노출 — 깜빡임 최소화
  if (!me) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "내 문서 목록" }]} />
        <h1 className="text-3xl font-bold tracking-tight">내 문서 목록</h1>
        <p className="mt-1.5 text-sm text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  return me.user.role === "admin" ? <AdminPostsView /> : <UserFormsView />;
}

// ── admin: 본인 게시글 ─────────────────────────────────────────────────

function AdminPostsView() {
  const [posts, setPosts] = useState<MyPost[] | null>(null);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  // 상태 필터 — 기본은 전체 선택. 정책 보드의 중요도 필터와 동일 패턴.
  const [statusFilter, setStatusFilter] = useState<Set<PostStatusKey>>(
    () => new Set(POST_STATUS_OPTIONS.map((o) => o.key)),
  );

  const refetch = useCallback(() => {
    Promise.all([api.listMyPosts("policy"), api.listMyPosts("process")])
      .then(([policy, process]) => {
        const merged: MyPost[] = [
          ...policy.map((p) => ({ ...p, board: "policy" as BoardType })),
          ...process.map((p) => ({ ...p, board: "process" as BoardType })),
        ];
        merged.sort(
          (a, b) => parseUtc(b.updated_at).getTime() - parseUtc(a.updated_at).getTime(),
        );
        setPosts(merged);
      })
      .catch(() => setPosts([]));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // 검색 + 상태 필터
  const filtered = useMemo(() => {
    if (!posts) return null;
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      // 상태 필터 — 체크된 상태만 통과
      if (!statusFilter.has(postStatusKey(p))) return false;
      if (!q) return true;
      const haystack = [p.title, p.author_name, BOARD_LABELS[p.board], postStatusLabel(p)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, statusFilter]);

  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const pageItems = useMemo(() => {
    if (!filtered) return null;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "정책 / 프로세스 게시글 관리" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">정책 / 프로세스 게시글 관리</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            작성한 정책 / 프로세스 게시글을 확인하고 이어서 작성하거나 수정 및 삭제할 수 있습니다.
          </p>
        </div>
      </div>

      <section className="mt-6">
        {/* 툴바 — 페이지 크기 + 검색 */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
          <div className="relative min-w-[260px] max-w-md flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 작성자, 게시판, 상태로 검색"
              className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none"
            />
          </div>
          <PostStatusFilterDropdown selected={statusFilter} onChange={setStatusFilter} />
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="w-48 px-6 py-3 font-medium">게시판</th>
                <th className="px-6 py-3 font-medium">제목</th>
                <th className="w-32 px-6 py-3 font-medium">작성자</th>
                <th className="w-28 px-6 py-3 font-medium">상태</th>
                <th className="w-44 px-6 py-3 font-medium">최근 수정</th>
                <th className="w-56 px-6 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {pageItems === null ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {posts && posts.length > 0
                      ? "검색 결과가 없습니다."
                      : "작성한 게시글이 없습니다."}
                  </td>
                </tr>
              ) : (
                pageItems.map((p) => (
                  <tr key={`${p.board}-${p.id}`} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">{BOARD_LABELS[p.board]}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/governance/${boardSegment(p.board)}/${p.id}`}
                        className="font-medium hover:text-brand"
                      >
                        {p.title || <span className="italic text-gray-400">(제목 없음)</span>}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{p.author_name}</td>
                    <td className="px-6 py-4">
                      <PostStatusBadge post={p} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDateTime(p.updated_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Link
                          href={`/governance/${boardSegment(p.board)}/new?id=${p.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                        >
                          <Pencil size={12} /> 수정
                        </Link>
                        <DeletePostButton board={p.board} postId={p.id} onDeleted={refetch} />
                      </div>
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
            <PostsPagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </section>
    </div>
  );
}

/** 게시글 상태 다중 선택 드롭다운 — 임시저장 / 비공개 / 게시됨 체크박스. */
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

function PostsPagination({
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

function PostStatusBadge({ post }: { post: MyPost }) {
  if (post.is_draft) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        임시저장
      </span>
    );
  }
  if (post.visibility === "admin") {
    return (
      <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
        비공개
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      게시됨
    </span>
  );
}

// ── 일반 사용자: 본인 신청서 ────────────────────────────────────────────

function UserFormsView() {
  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const refetch = useCallback(() => {
    api.listForms({ mine: true }).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // 다른 탭에서 수정 후 돌아오거나 브라우저 포커스 복원 시 자동 새로고침 — Router Cache 안전망.
  useEffect(() => {
    function onFocus() {
      refetch();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refetch]);

  // base request_no 별 그룹핑 → 그룹당 최신 1개만 메인에 노출.
  const latestItems = useMemo(() => {
    if (!items) return null;
    const byBase = new Map<string, FormListItem[]>();
    for (const it of items) {
      const base = getBaseRequestNo(it.request_no);
      const arr = byBase.get(base) ?? [];
      arr.push(it);
      byBase.set(base, arr);
    }
    const latest: FormListItem[] = [];
    for (const [, group] of byBase) {
      group.sort((a, b) => {
        const dp = statusPriority(b.status) - statusPriority(a.status);
        if (dp !== 0) return dp;
        return parseUtc(b.submitted_at).getTime() - parseUtc(a.submitted_at).getTime();
      });
      latest.push(group[0]);
    }
    latest.sort(
      (a, b) => parseUtc(b.submitted_at).getTime() - parseUtc(a.submitted_at).getTime(),
    );
    return latest;
  }, [items]);

  const filtered = useMemo(() => {
    if (!latestItems) return null;
    return filter === "all" ? latestItems : latestItems.filter((it) => it.status === filter);
  }, [latestItems, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: latestItems?.length ?? 0 };
    for (const it of latestItems ?? []) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [latestItems]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "내 문서 목록" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">내 문서 목록</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            프로젝트명을 클릭하면 신청서 상세를 확인하고 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            전체 {counts.all > 0 && <span className="ml-1 text-gray-400">({counts.all})</span>}
          </FilterChip>
          {STATUSES.filter((s) => s.value !== "rejected").map((s) => (
            <FilterChip
              key={s.value}
              active={filter === s.value}
              onClick={() => setFilter(s.value)}
            >
              {s.label}
              {(counts[s.value] ?? 0) > 0 && (
                <span className="ml-1 text-gray-400">({counts[s.value]})</span>
              )}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">신청서 종류</th>
              <th className="px-6 py-3 font-medium">프로젝트명</th>
              <th className="w-28 px-6 py-3 font-medium">상태</th>
              <th className="w-44 px-6 py-3 font-medium">제출일</th>
              <th className="w-40 px-6 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered === null ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  {latestItems && latestItems.length > 0
                    ? "선택한 상태의 신청서가 없습니다."
                    : "제출한 신청서가 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.map((it) => (
                <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">{FORM_TYPE_LABELS[it.form_type]}</td>
                  <td className="px-6 py-4">
                    <Link href={`/governance/forms/detail/${it.id}?from=my`} className="block hover:text-brand">
                      <div className="font-semibold">{it.project_name}</div>
                      <div className="text-xs text-gray-400">{it.request_no}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={it.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDateTime(it.submitted_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={api.exportFormUrl(it.id)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        <Download size={12} /> Excel
                      </a>
                      <DeleteFormButton
                        formId={it.id}
                        contextLabel={it.project_name}
                        onDeleted={refetch}
                      />
                    </div>
                  </td>
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
