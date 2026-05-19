"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  governanceRequests,
  statusLabel,
  statusBadgeClass,
  priorityBadgeClass,
  GovernanceStatus,
} from "@/lib/storyboard/governance-data";

const tabs: { value: "all" | GovernanceStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState<"all" | GovernanceStatus>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c = { all: governanceRequests.length, in_review: 0, approved: 0, rejected: 0, draft: 0 };
    governanceRequests.forEach((r) => {
      c[r.status] = (c[r.status] ?? 0) + 1;
    });
    return c;
  }, []);

  const filtered = useMemo(() => {
    return governanceRequests.filter((r) => {
      const tabMatch = activeTab === "all" || r.status === activeTab;
      const q = query.trim().toLowerCase();
      const queryMatch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.relatedRepo.toLowerCase().includes(q);
      return tabMatch && queryMatch;
    });
  }, [activeTab, query]);

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-text-primary">
            Governance Requests
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            거버넌스 요청 목록을 관리하고 승인/반려 처리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="요청 ID, 제목, 레포지토리 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-72 pl-8"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-3.5 w-3.5" />
            Filter
          </Button>
          <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white">
            <Link href="/governance/new">
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Request
            </Link>
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-bg-surface">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              {t.label}
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-text-secondary">
                {counts[t.value as keyof typeof counts]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dh-border bg-white p-12 text-center text-sm text-text-secondary">
              조건에 맞는 요청이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-dh-border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-bg-surface text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dh-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-bg-surface/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <Link
                            href={`/governance/${r.id}`}
                            className="font-medium text-text-primary hover:text-brand"
                          >
                            {r.title}
                          </Link>
                          <span className="text-xs text-text-muted font-mono">{r.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{r.type}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-surface text-[10px] font-semibold text-text-primary">
                            {r.requester.initials}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-xs text-text-primary">{r.requester.name}</span>
                            <span className="text-[10px] text-text-muted">{r.requester.org}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${priorityBadgeClass[r.priority]}`}
                        >
                          {r.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass[r.status]}`}
                        >
                          {statusLabel[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{r.updatedAt}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/governance/${r.id}`}
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

      <div className="mt-6 flex items-center justify-between text-xs text-text-secondary">
        <span>{filtered.length}건 표시</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, "...", 12].map((n, i) => (
            <button
              key={i}
              className={`h-7 w-7 rounded-md text-xs ${
                n === 1
                  ? "bg-brand text-white"
                  : "border border-dh-border bg-white text-text-secondary hover:bg-bg-surface"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
