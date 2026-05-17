"use client";

// 관리자 전용 — 모든 사용자의 신청 검토 / 승인 진입점.
// admin 이 아니면 권한 없음 안내. 기존 detail 페이지의 진행 상태 패널에서 액션 수행.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Search } from "lucide-react";
import { api, type FormListItem, type FormStatus, type Me } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import {
  RequestStatusTabs,
  type StatusTab,
  type TabFilter,
} from "@/components/RequestStatusTabs";
import { FORM_TYPE_LABELS, formatDateTime } from "@/lib/utils";

const PAGE_SIZES = [5, 10, 20, 50, 100];

// 반려는 admin 액션에서 제거됨 → 필터에서도 노출 안 함
const STATUS_OPTIONS = STATUSES.filter((s) => s.value !== "rejected");

// 탭 필터 → FormStatus 매핑 (요청 목록 페이지와 동일 규칙).
const TAB_TO_STATUSES: Record<TabFilter, FormStatus[]> = {
  all: STATUS_OPTIONS.map((s) => s.value),
  "in-progress": ["draft", "submitted", "reviewing"],
  completed: ["approved"],
};

export default function AdminFormsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const refetch = useCallback(() => {
    api.listForms({ mine: false }).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    refetch();
  }, [refetch]);

  // 탭 카운트 산정용 — 상태 필터 적용 전, 반려 제외 + 검색 적용 후.
  const beforeStatusFilter = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (it.status === "rejected") return false;
      if (!q) return true;
      const statusLabel = STATUSES.find((s) => s.value === it.status)?.label ?? "";
      const haystack = [
        FORM_TYPE_LABELS[it.form_type] ?? "",
        it.project_name,
        it.submitter_name,
        it.request_no,
        statusLabel,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const filtered = useMemo(() => {
    if (!beforeStatusFilter) return null;
    const allowed = new Set<FormStatus>(TAB_TO_STATUSES[activeTab]);
    return beforeStatusFilter.filter((it) => allowed.has(it.status as FormStatus));
  }, [beforeStatusFilter, activeTab]);

  const tabs: StatusTab[] = useMemo(() => {
    const base = beforeStatusFilter ?? [];
    const inProgressSet = new Set<FormStatus>(TAB_TO_STATUSES["in-progress"]);
    const completedSet = new Set<FormStatus>(TAB_TO_STATUSES["completed"]);
    return [
      { value: "all", label: "전체", count: base.length },
      {
        value: "in-progress",
        label: "진행 중",
        count: base.filter((it) => inProgressSet.has(it.status as FormStatus)).length,
      },
      {
        value: "completed",
        label: "완료",
        count: base.filter((it) => completedSet.has(it.status as FormStatus)).length,
      },
    ];
  }, [beforeStatusFilter]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, query, pageSize]);

  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const pageItems = useMemo(() => {
    if (!filtered) return null;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // 권한 거부 화면 (admin 아닌 사용자가 직접 URL 진입)
  if (me && me.user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-500">
          <Lock size={36} />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">접근 권한 없음</h1>
        <p className="mt-2 text-sm text-gray-500">관리자만 신청 검토 페이지를 조회할 수 있습니다.</p>
        <Link
          href="/governance"
          className="mt-5 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          Governance 로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Governance", href: "/governance" }, { label: "거버넌스 요청 관리" }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">거버넌스 요청 관리</h1>
      <p className="mt-1.5 text-sm text-gray-500">
        전체 사용자의 신청을 검토 / 승인할 수 있습니다. 프로젝트명을 클릭해 신청 상세 페이지로 이동한 뒤 처리해 주세요.
      </p>

      {/* 툴바 — 페이지 크기 + 검색 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
            placeholder="신청 종류, 프로젝트명, 신청자, 요청번호로 검색"
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4">
        <RequestStatusTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">신청 종류</th>
              <th className="px-6 py-3 font-medium">프로젝트명</th>
              <th className="w-32 px-6 py-3 font-medium">신청자</th>
              <th className="w-28 px-6 py-3 font-medium">상태</th>
              <th className="w-44 px-6 py-3 font-medium">제출일</th>
              <th className="w-44 px-6 py-3 font-medium">승인 완료일</th>
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
                  {items && items.length > 0
                    ? "검색·필터 결과가 없습니다."
                    : "제출된 신청이 없습니다."}
                </td>
              </tr>
            ) : (
              pageItems.map((it) => (
                <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">{FORM_TYPE_LABELS[it.form_type]}</td>
                  <td className="px-6 py-4">
                    <Link href={`/governance/forms/detail/${it.id}?from=admin`} className="block hover:text-brand">
                      <div className="font-semibold">{it.project_name}</div>
                      <div className="text-xs text-gray-400">{it.request_no}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{it.submitter_name}</td>
                  <td className="px-6 py-4"><StatusBadge status={it.status} /></td>
                  <td className="px-6 py-4 text-gray-500">{formatDateTime(it.submitted_at)}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {it.approved_at ? formatDateTime(it.approved_at) : <span className="text-gray-300">-</span>}
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
