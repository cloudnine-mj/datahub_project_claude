"use client";

/**
 * 거버넌스 요청 관리 — admin 만 접근 가능한 검토·승인 진입 목록.
 *
 * 6 영역 구성:
 *   1. Breadcrumb
 *   2. 제목 + 설명
 *   3. KPI 카드 4 (승인 대기 / 진행 중 / 이번 주 처리 / 평균 처리 시간)
 *   4. 상태 필터 칩 (카운트 뱃지 포함)
 *   5. 도구 모음 (신청 종류 select / 검색 / CSV)
 *   6. 데이터 테이블 (행 클릭 → 상세 페이지 이동)
 *
 * KPI / 카운트 / 필터링은 클라이언트 사이드 — listForms 한 번에 받아서 derive.
 * 상태/유형/검색 필터는 URL ?status=&type=&q= 로 동기화.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Download, Inbox } from "lucide-react";
import { api, type FormListItem, type FormStatus, type Me } from "@/lib/governance/api-client-full";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { FORM_TYPE_LABELS } from "@/lib/governance/forms/utils-bridge";

type StatusFilter = "all" | "submitted" | "reviewing" | "approved";

interface KpiStat {
  pending: number;
  inProgress: number;
  thisWeek: number;
  avgDays: number;
}

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "submitted", label: "제출됨" },
  { value: "reviewing", label: "검토 중" },
  { value: "approved", label: "승인 완료" },
];

const STATUS_BADGE: Record<FormStatus, { bg: string; text: string; dot: string; label: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400", label: "임시 저장" },
  submitted: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "제출됨" },
  reviewing: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "검토 중" },
  approved: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "승인 완료" },
  rejected: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", label: "반려" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

function thisWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: monday, end };
}

function computeKpi(forms: FormListItem[]): KpiStat {
  const pending = forms.filter((f) => f.status === "submitted").length;
  const inProgress = forms.filter((f) => f.status === "reviewing").length;

  const week = thisWeekRange();
  let thisWeek = 0;
  let totalDays = 0;
  let approvedCount = 0;
  for (const f of forms) {
    const item = f as FormListItem & { approvedAt?: string | null };
    if (!item.approvedAt) continue;
    const at = new Date(item.approvedAt);
    if (at >= week.start && at <= week.end) thisWeek += 1;
    const submitted = new Date(f.submittedAt);
    if (!Number.isNaN(submitted.getTime()) && !Number.isNaN(at.getTime())) {
      totalDays += (at.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24);
      approvedCount += 1;
    }
  }
  const avgDays = approvedCount > 0 ? totalDays / approvedCount : 0;
  return { pending, inProgress, thisWeek, avgDays };
}

function toCsv(rows: FormListItem[]): string {
  const header = ["신청번호", "신청 종류", "신청서명", "신청자", "상태", "제출일", "승인 완료일"];
  const body = rows.map((r) => {
    const item = r as FormListItem & { approvedAt?: string | null };
    return [
      r.requestNo,
      FORM_TYPE_LABELS[r.formType] ?? r.formType,
      JSON.stringify(r.projectName),
      r.submitterName,
      STATUS_BADGE[r.status]?.label ?? r.status,
      fmtDate(r.submittedAt) + " " + fmtTime(r.submittedAt),
      item.approvedAt ? fmtDate(item.approvedAt) + " " + fmtTime(item.approvedAt) : "",
    ].join(",");
  });
  return [header.join(","), ...body].join("\n");
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusParam = (searchParams?.get("status") as StatusFilter | null) ?? "all";
  const typeParam = searchParams?.get("type") ?? "all";
  const queryParam = searchParams?.get("q") ?? "";

  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [authError, setAuthError] = useState(false);
  const [query, setQuery] = useState(queryParam);

  const updateUrl = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?");
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== queryParam) updateUrl({ q: query });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    api
      .listForms({ mine: false })
      .then(setItems)
      .catch(() => setItems([]));
    api
      .me()
      .then((m: Me) => {
        if (m.user.role !== "admin") setAuthError(true);
      })
      .catch(() => setAuthError(true));
  }, []);

  const kpi = useMemo(() => (items ? computeKpi(items) : null), [items]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, submitted: 0, reviewing: 0, approved: 0 };
    (items ?? []).forEach((it) => {
      if (it.status === "rejected" || it.status === "draft") return;
      c.all += 1;
      if (it.status === "submitted") c.submitted += 1;
      else if (it.status === "reviewing") c.reviewing += 1;
      else if (it.status === "approved") c.approved += 1;
    });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((it) => {
      if (it.status === "draft" || it.status === "rejected") return false;
      if (statusParam !== "all" && it.status !== statusParam) return false;
      if (typeParam !== "all" && it.formType !== typeParam) return false;
      const q = queryParam.trim().toLowerCase();
      if (!q) return true;
      return (
        it.projectName.toLowerCase().includes(q) ||
        it.submitterName.toLowerCase().includes(q) ||
        it.requestNo.toLowerCase().includes(q)
      );
    });
  }, [items, statusParam, typeParam, queryParam]);

  if (authError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        관리자만 접근 가능한 페이지입니다.{" "}
        <Link href="/governance/forms/list" className="underline">
          요청 목록으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[{ label: "Governance", href: "/governance" }, { label: "거버넌스 요청 관리" }]}
      />

      <h1 className="text-[22px] font-medium tracking-tight">거버넌스 요청 관리</h1>
      <p className="mt-1 text-sm text-gray-500">
        전체 사용자의 신청을 검토 / 승인할 수 있습니다. 신청서명을 클릭해 상세 페이지로 이동한 뒤 처리해 주세요.
      </p>

      {/* KPI 카드 4개 */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="승인 대기" value={kpi?.pending} unit="건" loading={!kpi} />
        <KpiCard label="진행 중" value={kpi?.inProgress} unit="건" loading={!kpi} />
        <KpiCard label="이번 주 처리" value={kpi?.thisWeek} unit="건" loading={!kpi} />
        <KpiCard
          label="평균 처리 시간"
          value={kpi ? kpi.avgDays.toFixed(1) : undefined}
          unit="일"
          loading={!kpi}
        />
      </div>

      {/* 상태 필터 칩 */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">상태</span>
        {STATUS_CHIPS.map((c) => {
          const active = statusParam === c.value;
          const count = counts[c.value];
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => updateUrl({ status: c.value })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${
                active
                  ? "border-gray-300 bg-white font-medium text-gray-900"
                  : "border-gray-200 bg-transparent text-gray-600 hover:bg-gray-50"
              }`}
            >
              {c.label}
              <span
                className={`inline-flex items-center rounded-full px-1.5 text-[11px] ${
                  active ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 도구 모음 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={typeParam}
          onChange={(e) => updateUrl({ type: e.target.value })}
          className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none"
        >
          <option value="all">신청 종류 전체</option>
          {Object.entries(FORM_TYPE_LABELS)
            // 데이터 제작 계획서 / 업무생산성 도구는 필터 옵션에서 제외 — 거버넌스 요청 관리 흐름과 무관.
            .filter(([k]) => k !== "data_production_plan" && k !== "productivity_tool")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="신청서명, 신청자로 검색"
          className="min-w-[200px] flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px] placeholder:text-gray-400 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            const csv = toCsv(filtered);
            const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `governance-requests-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-50"
        >
          <Download size={14} />
          CSV
        </button>
      </div>

      {/* 테이블 */}
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col style={{ width: 160 }} />
            <col />
            <col style={{ width: 140 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 32 }} />
          </colgroup>
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">신청 종류</th>
              <th className="px-3 py-2.5 font-medium">신청서명</th>
              <th className="px-3 py-2.5 font-medium">신청자</th>
              <th className="px-3 py-2.5 font-medium">상태</th>
              <th className="px-3 py-2.5 font-medium">제출일</th>
              <th className="px-3 py-2.5 font-medium">승인 완료일</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items === null ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {[...Array(7)].map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3">
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <Inbox size={32} className="text-gray-300" />
                    <p className="text-sm text-gray-500">조건에 맞는 요청이 없습니다</p>
                    <p className="text-xs text-gray-400">필터를 변경해보세요</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((it) => {
                const item = it as FormListItem & { approvedAt?: string | null };
                const badge = STATUS_BADGE[it.status];
                return (
                  <tr
                    key={it.id}
                    onClick={() =>
                      router.push(`/governance/forms/detail/${it.id}?from=admin`)
                    }
                    className="cursor-pointer border-t border-gray-100 transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                      {FORM_TYPE_LABELS[it.formType] ?? it.formType}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-blue-700 hover:underline">
                        {it.projectName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">{it.requestNo}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">{it.submitterName}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${badge.bg} ${badge.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-[12px] text-gray-600">{fmtDate(it.submittedAt)}</div>
                      <div className="text-[11px] text-gray-400">{fmtTime(it.submittedAt)}</div>
                    </td>
                    <td className="px-3 py-3">
                      {item.approvedAt ? (
                        <>
                          <div className="text-[12px] font-medium text-emerald-700">
                            {fmtDate(item.approvedAt)}
                          </div>
                          <div className="text-[11px] text-emerald-700/75">
                            {fmtTime(item.approvedAt)}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-300">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        총 {filtered.length}건 표시 · 행을 클릭하면 상세 페이지에서 검토·승인할 수 있습니다
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  loading,
}: {
  label: string;
  value: number | string | undefined;
  unit: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-md bg-gray-50 p-4">
      <p className="text-[13px] text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-6 w-1/2 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className="mt-0.5 text-[24px] font-medium text-gray-900">
          {value ?? "-"}
          <span className="ml-1 text-[13px] font-normal text-gray-500">{unit}</span>
        </p>
      )}
    </div>
  );
}
