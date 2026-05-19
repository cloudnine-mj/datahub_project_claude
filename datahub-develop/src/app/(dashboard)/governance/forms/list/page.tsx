"use client";

// 거버넌스 요청 목록 — datahub-web 원본 디자인 그대로 포팅.
// 검색 + '내 업무만 보기' 체크박스 + 상태 탭(전체/임시저장/진행 중/완료) + 페이지 크기 셀렉터
// + 정렬: 최신 제출일순 + 페이지네이션 (1 2 3 ...)

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardX,
  Filter,
  List,
  Search,
} from "lucide-react";
import { api, type FormListItem, type FormStatus, type Me } from "@/lib/governance/api-client-full";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { StatusBadge, STATUSES } from "@/components/governance/StatusBadge";
import {
  RequestStatusTabs,
  type StatusTab,
  type TabFilter,
} from "@/components/governance/RequestStatusTabs";
import { FORM_TYPE_LABELS, formatDateTime } from "@/lib/governance/forms/utils-bridge";
import { isAssigneeByType } from "@/lib/governance/forms/role-mapping";

const PAGE_SIZES = [5, 10, 20, 50, 100];

// '관리' 페이지와 동일하게 반려는 제외 (목록에서도 노출 X)
const STATUS_OPTIONS = STATUSES.filter((s) => s.value !== "rejected");

// 탭 필터 → FormStatus 매핑.
const TAB_TO_STATUSES: Record<TabFilter, FormStatus[]> = {
  all: STATUS_OPTIONS.map((s) => s.value),
  draft: ["draft"],
  "in-progress": ["submitted", "reviewing"],
  completed: ["approved"],
};

interface ListItem extends FormListItem {
  /** 클라이언트에서 계산 — approved 일 때 마지막 approved 이벤트 시각. */
  approvedAt?: string | null;
}

export default function GovernanceFormsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // '내 업무만 보기' 상태는 URL ?filter=my 로 동기화
  const mineOnly = searchParams?.get("filter") === "my";
  const setMineOnly = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (next) params.set("filter", "my");
      else params.delete("filter");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?");
    },
    [router, searchParams],
  );

  const refetch = useCallback(() => {
    api
      .listForms({ mine: false })
      .then((rows) => setItems(rows.map((r) => r as ListItem)))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refetch();
    api.me().then(setMe).catch(() => setMe(null));
  }, [refetch]);

  // 로그인 사용자 식별자 (이름 / 이메일 / 이메일 로컬파트) 소문자 정규화
  const myIdentifiers = useMemo(() => {
    if (!me) return null;
    const norm = (s: string) => s.trim().toLowerCase();
    const local = me.user.email.split("@")[0] ?? "";
    const set = new Set<string>([norm(me.user.name), norm(me.user.email), norm(local)]);
    set.delete("");
    return set;
  }, [me]);

  const beforeStatusFilter = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (it.status === "rejected") return false;
      if (mineOnly) {
        if (!myIdentifiers) return false;
        const isMine = myIdentifiers.has(it.submitterName.trim().toLowerCase());
        const isParticipant = (it.participants || []).some((p) =>
          myIdentifiers.has(p.trim().toLowerCase()),
        );
        const isAssignee = isAssigneeByType(it.formType, myIdentifiers);
        if (!isMine && !isParticipant && !isAssignee) return false;
      }
      if (!q) return true;
      const statusLabel = STATUSES.find((s) => s.value === it.status)?.label ?? "";
      const haystack = [
        FORM_TYPE_LABELS[it.formType] ?? "",
        it.projectName,
        it.submitterName,
        it.requestNo,
        statusLabel,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, mineOnly, myIdentifiers]);

  const filtered = useMemo(() => {
    if (!beforeStatusFilter) return null;
    const allowed = new Set<FormStatus>(TAB_TO_STATUSES[activeTab]);
    return beforeStatusFilter.filter((it) => allowed.has(it.status as FormStatus));
  }, [beforeStatusFilter, activeTab]);

  const tabs: StatusTab[] = useMemo(() => {
    const base = beforeStatusFilter ?? [];
    const draftSet = new Set<FormStatus>(TAB_TO_STATUSES["draft"]);
    const inProgressSet = new Set<FormStatus>(TAB_TO_STATUSES["in-progress"]);
    const completedSet = new Set<FormStatus>(TAB_TO_STATUSES["completed"]);
    return [
      { value: "all", label: "전체", count: base.length },
      {
        value: "draft",
        label: "임시저장",
        count: base.filter((it) => draftSet.has(it.status as FormStatus)).length,
      },
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
  }, [activeTab, query, pageSize, mineOnly]);

  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const pageItems = useMemo(() => {
    if (!filtered) return null;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Governance", href: "/governance" }, { label: "거버넌스 요청 목록" }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">거버넌스 요청 목록</h1>
      <p className="mt-1.5 text-sm text-gray-500">
        전체 사용자의 신청 현황을 확인할 수 있습니다. 신청서명을 클릭하면 상세 페이지로 이동합니다.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="appearance-none rounded-md border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm focus:border-brand focus:outline-none"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}개씩 보기
              </option>
            ))}
          </select>
        </div>
        <div className="relative min-w-[260px] max-w-md flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="신청 종류, 신청서명, 신청자, 요청번호로 검색"
            className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none"
          />
        </div>
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition ${
            mineOnly
              ? "bg-blue-50 font-medium text-blue-700"
              : "text-gray-700"
          } ${!me ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            disabled={!me}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>내 업무만 보기</span>
        </label>
      </div>

      {mineOnly && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2">
          <Filter size={12} aria-hidden="true" className="shrink-0 text-blue-700" />
          <span className="text-[11px] text-blue-700">
            본인이 신청하거나 담당자로 지정된 요청만 표시 중
          </span>
        </div>
      )}

      <div className="mt-4">
        <RequestStatusTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {mineOnly && pageItems !== null && pageItems.length === 0 ? (
        <div className="rounded-lg bg-gray-50 px-5 py-10 text-center">
          <ClipboardX size={28} aria-hidden="true" className="mx-auto mb-2 text-gray-400" />
          <p className="text-[13px] font-medium text-gray-700">관련된 업무가 없습니다</p>
          <p className="mt-1 text-[11px] text-gray-500">
            본인이 신청하거나 담당자로 지정된 요청이 아직 없습니다.
            <br />
            전체 목록에서 다른 사용자의 신청 현황을 확인할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => setMineOnly(false)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-blue-700 transition hover:bg-blue-50"
          >
            <List size={13} aria-hidden="true" />
            전체 목록 보기
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">신청 종류</th>
                <th className="px-6 py-3 font-medium">신청서명</th>
                <th className="w-32 px-6 py-3 font-medium">신청자</th>
                <th className="w-28 px-6 py-3 font-medium">상태</th>
                <th className="w-44 px-6 py-3 font-medium">제출일</th>
                <th className="w-44 px-6 py-3 font-medium">승인 완료일</th>
              </tr>
            </thead>
            <tbody>
              {pageItems === null ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    불러오는 중...
                  </td>
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
                    <td className="px-6 py-4">{FORM_TYPE_LABELS[it.formType] ?? it.formType}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/governance/forms/detail/${it.id}?from=list`}
                        className="block hover:text-brand"
                      >
                        <div className="font-semibold">{it.projectName}</div>
                        <div className="text-xs text-gray-400">{it.requestNo}</div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{it.submitterName}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDateTime(it.submittedAt)}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {it.approvedAt ? (
                        formatDateTime(it.approvedAt)
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {pageItems && pageItems.length > 0 && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            총 {filtered?.length ?? 0} 건{mineOnly ? " 표시 (내 업무 기준)" : ""}
          </span>
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
          <span key={`gap-${i}`} className="px-2 text-xs text-gray-400">
            ...
          </span>
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
