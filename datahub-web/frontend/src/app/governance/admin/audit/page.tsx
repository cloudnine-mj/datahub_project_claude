"use client";

/**
 * Audit Trail — 거버넌스 활동 로그 (admin 전용).
 *
 * 별도 audit_events 테이블 없이 backend 가 기존 데이터(approval_history,
 * edit_history, form_comments, posts) 를 일관 포맷으로 집계해서 반환.
 * UI 는 검색/기간/severity 필터 + 클라이언트 페이지네이션 + CSV export 제공.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Lock,
  Search,
  XCircle,
} from "lucide-react";
import { api, type AuditEvent, type AuditSeverity, type Me } from "@/lib/api";

const PAGE_SIZE = 8;

const DAYS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "오늘" },
  { value: 7, label: "지난 7일" },
  { value: 30, label: "지난 30일" },
  { value: 90, label: "지난 90일" },
];

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
};

export default function AuditPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "">("");
  const [page, setPage] = useState(1);

  const refetch = useCallback(() => {
    setEvents(null);
    setError(null);
    api
      .listAuditEvents({ days })
      .then(setEvents)
      .catch((e: Error) => {
        setError(e.message);
        setEvents([]);
      });
  }, [days]);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // 클라이언트 사이드 필터 — 검색/severity. 페이지 리셋.
  const filtered = useMemo(() => {
    if (!events) return null;
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (severityFilter && e.severity !== severityFilter) return false;
      if (!q) return true;
      return (
        e.actor.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q)
      );
    });
  }, [events, search, severityFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, severityFilter, days]);

  const total = filtered?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = useMemo(() => {
    if (!filtered) return [];
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function exportCsv() {
    if (!filtered || filtered.length === 0) return;
    const header = ["timestamp", "actor", "action", "target", "detail", "severity"];
    const rows = filtered.map((e) => [
      e.timestamp,
      e.actor,
      e.action,
      e.target,
      e.detail.replace(/\s+/g, " "),
      e.severity,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `audit-trail-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 권한 거부 화면
  if (me && me.user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-500">
          <Lock size={36} />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">접근 권한 없음</h1>
        <p className="mt-2 text-sm text-gray-500">관리자만 감사 로그를 조회할 수 있습니다.</p>
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            거버넌스 관련 모든 활동 기록을 추적합니다. 이벤트는 90일간 보관됩니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이벤트, 사용자, 대상 검색..."
              className="h-10 w-72 rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm focus:border-brand focus:outline-none"
          >
            {DAYS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <SeverityFilterMenu value={severityFilter} onChange={setSeverityFilter} />
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filtered || filtered.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-48 px-6 py-3 font-medium">발생 시각</th>
              <th className="w-40 px-6 py-3 font-medium">사용자</th>
              <th className="w-56 px-6 py-3 font-medium">활동</th>
              <th className="w-48 px-6 py-3 font-medium">대상</th>
              <th className="px-6 py-3 font-medium">상세</th>
              <th className="w-28 px-6 py-3 font-medium">중요도</th>
            </tr>
          </thead>
          <tbody>
            {events === null ? (
              <tr>
                <td colSpan={6} className="px-6 py-14 text-center text-gray-400">
                  불러오는 중...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-14 text-center text-gray-400">
                  조회된 이벤트가 없습니다.
                </td>
              </tr>
            ) : (
              pageItems.map((e, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/60">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {formatTimestamp(e.timestamp)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-800">{e.actor}</span>
                  </td>
                  <td className="px-6 py-4">
                    <code className="rounded bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700">
                      {e.action}
                    </code>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">{e.target}</td>
                  <td className="px-6 py-4 text-gray-700">{e.detail}</td>
                  <td className="px-6 py-4">
                    <SeverityBadge severity={e.severity} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>
          {total > 0 ? `${pageItems.length}건 / 총 ${total}건` : "조회된 이벤트 없음"}
        </span>
        {pageCount > 1 && (
          <Pagination current={page} total={pageCount} onChange={setPage} />
        )}
      </div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  } catch {
    return iso;
  }
}

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const map: Record<AuditSeverity, { cls: string; icon: typeof FileText }> = {
    info: { cls: "bg-blue-50 text-blue-600", icon: FileText },
    success: { cls: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
    warning: { cls: "bg-amber-50 text-amber-600", icon: AlertTriangle },
    danger: { cls: "bg-red-50 text-red-600", icon: XCircle },
  };
  const { cls, icon: Icon } = map[severity];
  return (
    <span className={"inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold " + cls}>
      <Icon size={11} /> {SEVERITY_LABELS[severity]}
    </span>
  );
}

function SeverityFilterMenu({
  value,
  onChange,
}: {
  value: AuditSeverity | "";
  onChange: (v: AuditSeverity | "") => void;
}) {
  return (
    <details className="relative">
      <summary
        className={
          "inline-flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold hover:bg-gray-50 " +
          (value ? "ring-1 ring-brand/30" : "")
        }
      >
        <Filter size={14} />
        Filter
        {value && <span className="text-[10px] font-bold text-brand">· {value}</span>}
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md">
        {(["", "info", "success", "warning", "danger"] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => {
              onChange(s);
              // details close
              (document.activeElement as HTMLElement)?.blur();
            }}
            className={
              "block w-full px-3 py-2 text-left text-xs hover:bg-gray-50 " +
              (value === s ? "font-bold text-brand" : "text-gray-600")
            }
          >
            {s === "" ? "전체" : SEVERITY_LABELS[s]}
          </button>
        ))}
      </div>
    </details>
  );
}

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (n: number) => void;
}) {
  // 간단 페이지네이션 — 첫 3 / 현재 주변 / 마지막. 1, 2, 3, ..., N
  const pages: (number | "…")[] = [];
  const push = (n: number | "…") => pages.push(n);
  if (total <= 7) {
    for (let i = 1; i <= total; i++) push(i);
  } else {
    push(1);
    push(2);
    push(3);
    if (current > 4) push("…");
    if (current > 3 && current < total - 2) push(current);
    if (current < total - 3) push("…");
    push(total);
  }
  return (
    <div className="flex items-center gap-1">
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-2 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={
              "h-7 min-w-7 rounded px-2 text-xs font-semibold " +
              (p === current ? "bg-brand text-white" : "bg-white text-gray-600 hover:bg-gray-50")
            }
          >
            {p}
          </button>
        ),
      )}
    </div>
  );
}
