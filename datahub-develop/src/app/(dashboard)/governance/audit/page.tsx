"use client";

import { useState } from "react";
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const events = [
  {
    time: "2026-04-30 09:14:22",
    actor: "Sanghyun Seo",
    action: "request.created",
    target: "GR-2026-0042",
    severity: "info" as const,
    detail: "Model Release 요청 생성",
  },
  {
    time: "2026-04-30 09:08:11",
    actor: "Jieun Kim",
    action: "request.approved",
    target: "GR-2026-0041",
    severity: "success" as const,
    detail: "Dataset Publishing 요청 승인",
  },
  {
    time: "2026-04-30 08:42:09",
    actor: "System",
    action: "policy.applied",
    target: "GR-2026-0042",
    severity: "info" as const,
    detail: "정책 템플릿 자동 매칭: Model Release Approval",
  },
  {
    time: "2026-04-30 07:15:33",
    actor: "Soyeon Choi",
    action: "request.rejected",
    target: "GR-2026-0038",
    severity: "danger" as const,
    detail: "appliance-logs-v3 외부 공유 요청 반려 (개인정보 식별 위험)",
  },
  {
    time: "2026-04-29 22:51:07",
    actor: "System",
    action: "alert.classification",
    target: "lg-data/medical-records-2025",
    severity: "warning" as const,
    detail: "민감도 등급 자동 분류 — Confidential",
  },
  {
    time: "2026-04-29 21:03:52",
    actor: "Minjun Park",
    action: "permission.granted",
    target: "lg-data/korean-ner-corpus",
    severity: "success" as const,
    detail: "Vehicle OS 팀에 read 권한 부여 (90일)",
  },
  {
    time: "2026-04-29 18:24:18",
    actor: "Jieun Kim",
    action: "policy.updated",
    target: "Model Release Approval",
    severity: "info" as const,
    detail: "QA 검토 단계 추가",
  },
  {
    time: "2026-04-29 14:11:00",
    actor: "Sanghyun Seo",
    action: "request.commented",
    target: "GR-2026-0039",
    severity: "info" as const,
    detail: "GPU 64대 증설 요청에 코멘트 추가",
  },
];

const severityIcon = {
  info: { icon: FileText, className: "text-accent-blue" },
  success: { icon: CheckCircle2, className: "text-accent-green" },
  warning: { icon: AlertTriangle, className: "text-accent-orange" },
  danger: { icon: XCircle, className: "text-brand" },
};

const severityBadge = {
  info: "bg-blue-50 text-accent-blue",
  success: "bg-green-50 text-accent-green",
  warning: "bg-orange-50 text-accent-orange",
  danger: "bg-red-50 text-brand",
};

export default function AuditTrailPage() {
  const [query, setQuery] = useState("");
  const filtered = events.filter((e) =>
    !query
      ? true
      : `${e.actor} ${e.action} ${e.target} ${e.detail}`
          .toLowerCase()
          .includes(query.toLowerCase())
  );

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-text-primary">
            Audit Trail
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            거버넌스 관련 모든 활동 기록을 추적합니다. 이벤트는 90일간 보관됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="이벤트, 사용자, 대상 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-72 pl-8"
            />
          </div>
          <Select defaultValue="7d">
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">지난 24시간</SelectItem>
              <SelectItem value="7d">지난 7일</SelectItem>
              <SelectItem value="30d">지난 30일</SelectItem>
              <SelectItem value="90d">지난 90일</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Filter className="mr-1 h-3.5 w-3.5" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-dh-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-bg-surface text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-4 py-3 w-44">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3">Severity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dh-border">
            {filtered.map((e, idx) => {
              const Icon = severityIcon[e.severity].icon;
              return (
                <tr key={idx} className="hover:bg-bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{e.time}</td>
                  <td className="px-4 py-3 text-text-primary">{e.actor}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-bg-surface px-1.5 py-0.5 text-xs text-accent-blue">
                      {e.action}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-text-secondary">{e.target}</td>
                  <td className="px-4 py-3 text-text-primary">{e.detail}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${severityBadge[e.severity]}`}
                    >
                      <Icon className={`h-3 w-3 ${severityIcon[e.severity].className}`} />
                      {e.severity}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs text-text-secondary">
        <span>{filtered.length}건 / 총 {events.length}건</span>
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
