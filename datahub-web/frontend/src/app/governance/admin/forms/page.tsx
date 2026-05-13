"use client";

// 관리자 전용 — 모든 사용자의 신청서 검토 / 승인 진입점.
// admin 이 아니면 권한 없음 안내. 기존 detail 페이지의 진행 상태 패널에서 액션 수행.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Lock, Search } from "lucide-react";
import { api, type FormListItem, type FormStatus, type Me } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import { FORM_TYPE_LABELS, formatDateTime } from "@/lib/utils";

const PAGE_SIZES = [5, 10, 20, 50, 100];

// 반려는 admin 액션에서 제거됨 → 필터에서도 노출 안 함
const STATUS_OPTIONS = STATUSES.filter((s) => s.value !== "rejected");

export default function AdminFormsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<FormListItem[] | null>(null);
  // 상태 필터 — 기본은 전체 선택. 다중 선택 가능.
  const [statusFilter, setStatusFilter] = useState<Set<FormStatus>>(
    () => new Set(STATUS_OPTIONS.map((s) => s.value)),
  );
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);

  const refetch = useCallback(() => {
    api.listForms({ mine: false }).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    refetch();
  }, [refetch]);

  // 상태 필터 + 검색 (신청서 종류 / 프로젝트명 / 신청자 / 요청번호 / 상태 라벨)
  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (!statusFilter.has(it.status as FormStatus)) return false;
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
  }, [items, statusFilter, query]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, query, pageSize]);

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
        <p className="mt-2 text-sm text-gray-500">관리자만 신청서 검토 페이지를 조회할 수 있습니다.</p>
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
        전체 사용자의 신청서를 검토 / 승인할 수 있습니다. 프로젝트명을 클릭해 신청서 상세 페이지로 이동한 뒤 처리해 주세요.
      </p>

      {/* 툴바 — 페이지 크기 + 검색 + 상태 필터 */}
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
            placeholder="신청서 종류, 프로젝트명, 신청자, 요청번호로 검색"
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none"
          />
        </div>
        <StatusFilterDropdown selected={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">신청서 종류</th>
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
                    : "제출된 신청서가 없습니다."}
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

/** 신청서 상태 다중 선택 드롭다운 — 임시저장 / 제출됨 / 검토 중 / 승인 완료. */
function StatusFilterDropdown({
  selected,
  onChange,
}: {
  selected: Set<FormStatus>;
  onChange: (next: Set<FormStatus>) => void;
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

  function toggle(value: FormStatus) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(STATUS_OPTIONS.map((s) => s.value)));
  }

  const isAll = selected.size === STATUS_OPTIONS.length;
  const summary = isAll
    ? "상태: 전체"
    : selected.size === 0
    ? "상태: 없음"
    : "상태: " + STATUS_OPTIONS.filter((s) => selected.has(s.value)).map((s) => s.label).join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[300px] items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
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
            {STATUS_OPTIONS.map((s) => {
              const checked = selected.has(s.value);
              return (
                <li key={s.value}>
                  <label
                    className={
                      "flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm " +
                      (checked ? "bg-blue-50/50 font-semibold text-blue-700" : "hover:bg-gray-50")
                    }
                  >
                    <span>{s.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.value)}
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
