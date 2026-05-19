/**
 * 거버넌스 요청 목록 — datahub-web `/governance/forms/list` 포팅.
 *
 * 모든 신청 종류 통합 노출, 상태 탭 필터 (전체/임시저장/진행 중/완료).
 * Phase 3 부분 — 데이터는 실 API (`governanceApi.listForms`), UI 는 datahub-develop
 * 의 ui primitives 사용. 추후 BoardListView / RequestStatusTabs 컴포넌트도 포팅 예정.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { governanceApi } from "@/lib/governance/api-client";
import type { FormListItem, FormStatus } from "@/lib/governance/forms/types";
import { APPLICATION_TYPE_LABEL } from "@/lib/governance/forms/application-config";

type TabKey = "all" | "draft" | "in_progress" | "done";

const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "draft", label: "임시 저장" },
  { value: "in_progress", label: "진행 중" },
  { value: "done", label: "완료" },
];

function statusTab(s: FormStatus): TabKey {
  if (s === "draft") return "draft";
  if (s === "approved" || s === "rejected") return "done";
  return "in_progress";
}

const statusLabel: Record<FormStatus, string> = {
  draft: "임시 저장",
  submitted: "제출됨",
  reviewing: "검토 중",
  approved: "승인 완료",
  rejected: "반려",
};

const statusBadge: Record<FormStatus, string> = {
  draft: "bg-bg-surface text-text-secondary border-dh-border",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  reviewing: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Page() {
  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    governanceApi
      .listForms({ mine: false })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: 0, draft: 0, in_progress: 0, done: 0 };
    (items ?? []).forEach((it) => {
      c.all += 1;
      c[statusTab(it.status)] += 1;
    });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const tabMatch = tab === "all" || statusTab(it.status) === tab;
      const queryMatch =
        !q ||
        it.projectName.toLowerCase().includes(q) ||
        it.requestNo.toLowerCase().includes(q) ||
        it.submitterName.toLowerCase().includes(q);
      return tabMatch && queryMatch;
    });
  }, [items, tab, query]);

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-text-primary">
            거버넌스 요청 목록
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            전체 신청서를 한눈에 확인합니다. 상세를 클릭하면 진행 이력과 채팅을 볼 수 있습니다.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="제목 / 신청번호 / 신청자 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-72 pl-8"
          />
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="bg-bg-surface">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              {t.label}
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-text-secondary">
                {counts[t.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {items === null ? (
            <div className="rounded-xl border border-dh-border bg-white p-12 text-center text-sm text-text-secondary">
              불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dh-border bg-white p-12 text-center text-sm text-text-secondary">
              조건에 맞는 요청이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-dh-border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-bg-surface text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">신청번호</th>
                    <th className="px-4 py-3">프로젝트</th>
                    <th className="px-4 py-3">유형</th>
                    <th className="px-4 py-3">신청자</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">제출일</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dh-border">
                  {filtered.map((it) => (
                    <tr key={it.id} className="hover:bg-bg-surface/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-text-muted">
                        {it.requestNo}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/governance/forms/${it.id}?from=list`}
                          className="font-medium text-text-primary hover:text-brand"
                        >
                          {it.projectName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {APPLICATION_TYPE_LABEL[mapType(it.formType)] ?? it.formType}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{it.submitterName}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadge[it.status]}`}
                        >
                          {statusLabel[it.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {new Date(it.submittedAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/governance/forms/${it.id}?from=list`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80"
                        >
                          Open
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-4 text-xs text-text-muted">{filtered.length}건 표시</p>
    </div>
  );
}

/** form_type → ApplicationType (label 매핑용). 기타 신청 종류는 fallback. */
function mapType(t: string): "service" | "purchase" | "subscribe" {
  if (t === "data_production") return "service";
  if (t === "data_subscription") return "subscribe";
  return "purchase";
}
