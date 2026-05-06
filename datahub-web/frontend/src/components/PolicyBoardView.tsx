"use client";

/**
 * 정책 게시판 — 사용자 여정 Step 1~3 의 Opportunity 를 모두 반영한 카드뷰.
 *
 *  Step 1) 상단 가이드 배너 — '이 페이지에서 확인할 수 있는 것'
 *  Step 2) 한 줄 설명 + 태그 + severity 뱃지 + 검색·필터 (인지 부하 ↓)
 *  Step 3) 카드 안에 적용 대상·갱신일 노출 (클릭 전 preview)
 *
 * 다른 게시판(production_process, usage_process) 은 BoardListView 를 그대로 씀.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Info, Pencil, Search, Users } from "lucide-react";
import { api, type Me, type PostListItem, type Severity } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { SeverityBadge, SEVERITIES } from "./SeverityBadge";
import { EmptyState } from "./EmptyState";
import { formatDate } from "@/lib/utils";

type SeverityFilter = "all" | Severity;

export function PolicyBoardView() {
  const [posts, setPosts] = useState<PostListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.listPosts("policy").then(setPosts).catch(() => setPosts([]));
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const canWrite = me?.permissions.can_write_policy ?? false;

  // Step 2 의 검색·필터 — 클라이언트 사이드. 데이터가 늘어나면 서버 쿼리로 옮길 것.
  const filtered = useMemo(() => {
    if (!posts) return null;
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (filter !== "all" && p.severity !== filter) return false;
      if (!q) return true;
      const haystack = [p.title, p.summary ?? "", (p.tags ?? []).join(" "), p.applies_to ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [posts, filter, query]);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 관리 정책" },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">데이터 관리 정책</h1>

      {/* Step 1 — 가이드 배너 */}
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-4">
        <div className="flex items-start gap-3 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <div className="font-semibold text-blue-900">이 페이지의 목적</div>
            <p className="mt-1 text-blue-800/80">
              데이터의 <strong className="font-semibold">생성·저장·활용·폐기</strong> 까지의 기준을 정의합니다.
              필요한 정책을 확인하고 <strong className="font-semibold">바로 실행</strong>할 수 있습니다.
            </p>
            <p className="mt-2 text-xs text-blue-800/60">
              제목 옆 <SeverityBadge severity="required" /> 는 반드시 지켜야 하는 정책,
              <SeverityBadge severity="recommended" /> 는 권장사항입니다.
              보안·승인 등 분류는 #태그 로 표시됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 필터 + 검색 + 글쓰기 */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>전체</FilterChip>
          {SEVERITIES.map((s) => (
            <FilterChip key={s.value} active={filter === s.value} onClick={() => setFilter(s.value)}>
              {s.label}
            </FilterChip>
          ))}
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

        {filter !== "all" && (
          canWrite ? (
            <Link
              href={`/governance/policy/new?severity=${filter}`}
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
          )
        )}
      </div>

      {/* 카드 목록 */}
      <div className="mt-4 space-y-3">
        {filtered === null ? (
          <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white">
            <EmptyState
              message={
                posts && posts.length > 0
                  ? "검색 결과가 없습니다. 다른 키워드로 다시 시도해 보세요."
                  : "등록된 정책이 없습니다 — 곧 추가될 예정입니다."
              }
            />
          </div>
        ) : (
          filtered.map((p) => <PolicyCard key={p.id} post={p} />)
        )}
      </div>

      {posts && posts.length > 0 && filtered && (
        <div className="mt-3 text-right text-xs text-gray-400">
          {filtered.length} / {posts.length} 건
        </div>
      )}
    </div>
  );
}

function PolicyCard({ post }: { post: PostListItem }) {
  return (
    <Link
      href={`/governance/policy/${post.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 transition hover:border-brand/40 hover:shadow-sm"
    >
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <SeverityBadge severity={post.severity} />
        {(post.tags ?? []).map((t) => (
          <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">#{t}</span>
        ))}
        <span className="ml-auto text-gray-400">갱신: {formatDate(post.updated_at)}</span>
      </div>

      <h3 className="mt-2 text-base font-bold tracking-tight">{post.title}</h3>
      {post.summary && <p className="mt-1 text-sm text-gray-600">{post.summary}</p>}

      {post.applies_to && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Users size={12} />
          <span>적용 대상: {post.applies_to}</span>
        </div>
      )}
    </Link>
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
