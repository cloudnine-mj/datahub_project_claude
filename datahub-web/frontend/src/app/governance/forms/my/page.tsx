"use client";

// 내 문서 목록 — 본인이 제출한 모든 신청서.
//
// request_no 가 같은 base ( '-vN' 접미사 제거한 값 ) 끼리 그룹핑.
// 그룹 안에서 가장 최근 row 1개만 메인 테이블에 노출하고, 나머지는 페이지
// 하단의 '수정 이력' 섹션에 정리해서 보여준다 — 화면 노이즈 감소.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  History,
  XCircle,
} from "lucide-react";
import {
  api,
  type AuditEvent,
  type AuditSeverity,
  type FormListItem,
  type FormStatus,
} from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteFormButton } from "@/components/DeleteFormButton";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import { FORM_TYPE_LABELS, formatDate } from "@/lib/utils";

type StatusFilter = "all" | FormStatus;

/** '-vN' 접미사를 제거한 base request_no. 그룹 키로 사용. */
function getBaseRequestNo(rn: string): string {
  return rn.replace(/-v\d+$/, "");
}

/**
 * 그룹 내 '가장 최신 버전' 판정 우선순위.
 *
 * 단순 timestamp 만 비교하면 '제출됨 v1 → 편집해서 임시저장 v2 → 방치' 일 때
 * 미완성 임시저장본이 최신으로 잡혀 사용자에게 혼란을 줌. 따라서 상태 자체의
 * '확정도' 를 1순위로 두고, 동일 상태 안에서 시각 역순으로 정렬.
 */
function statusPriority(status: string): number {
  if (status === "approved" || status === "rejected") return 4; // terminal
  if (status === "reviewing") return 3;
  if (status === "submitted") return 2;
  return 1; // draft
}

export default function MyFormsPage() {
  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[] | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const refetch = useCallback(() => {
    api.listForms({ mine: true }).then(setItems).catch(() => setItems([]));
    // 본인 활동 audit 이벤트 — 90일 보관. 실패 시 빈 배열로 묻고 메인 목록만 표시.
    api
      .listAuditEvents({ mine: true, days: 90 })
      .then(setAuditEvents)
      .catch(() => setAuditEvents([]));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // base request_no 별 그룹핑 → 그룹당 최신 1개만 메인에 노출.
  // (이전 버전들은 별도 테이블 대신 하단 audit 활동 기록 섹션으로 자연스럽게 흡수)
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
      // 1순위: 상태 우선순위(확정도), 2순위: 시각 역순
      group.sort((a, b) => {
        const dp = statusPriority(b.status) - statusPriority(a.status);
        if (dp !== 0) return dp;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
      latest.push(group[0]);
    }
    latest.sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
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
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "내 문서 목록" },
        ]}
      />
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
              <th className="w-32 px-6 py-3 font-medium">제출일</th>
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
                  <td className="px-6 py-4 text-gray-500">{formatDate(it.submitted_at)}</td>
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

      {/* 활동 기록 — audit trail 스타일. 본인 신청서 제출/수정/검토/승인/반려 이벤트 시간순. */}
      <ActivityLogSection events={auditEvents} />
    </div>
  );
}

/**
 * 활동 기록 — audit trail 형식.
 *
 * 신청서 row 1줄 = 이벤트 1개. 같은 신청서라도 제출 → 검토 시작 → 승인 처럼
 * 상태가 바뀔 때마다 별도 row 가 시간순으로 쌓임. 메인 테이블이 '지금 상태' 를
 * 보여준다면, 여기는 '거기까지 어떻게 왔는가' 를 보여줌.
 */
function ActivityLogSection({ events }: { events: AuditEvent[] | null }) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <History size={16} className="text-gray-500" />
        <h2 className="text-base font-bold tracking-tight">활동 기록</h2>
        <span className="text-xs text-gray-400">
          {events === null ? "..." : `${events.length}건`}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        내 신청서 제출 · 수정 · 검토 · 승인/반려 이벤트의 시간순 기록입니다. 최근 90일.
      </p>

      <div className="mt-3 rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-48 px-6 py-3 font-medium">Timestamp</th>
              <th className="w-40 px-6 py-3 font-medium">Actor</th>
              <th className="w-56 px-6 py-3 font-medium">Action</th>
              <th className="w-48 px-6 py-3 font-medium">Target</th>
              <th className="px-6 py-3 font-medium">Detail</th>
              <th className="w-28 px-6 py-3 font-medium">Severity</th>
            </tr>
          </thead>
          <tbody>
            {events === null ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  불러오는 중...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  최근 활동 기록이 없습니다.
                </td>
              </tr>
            ) : (
              events.map((e, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/60">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    {formatAuditTimestamp(e.timestamp)}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-800">{e.actor}</td>
                  <td className="px-6 py-4">
                    <code className="rounded bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700">
                      {e.action}
                    </code>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">{e.target}</td>
                  <td className="px-6 py-4 text-gray-700">{e.detail}</td>
                  <td className="px-6 py-4">
                    <AuditSeverityBadge severity={e.severity} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatAuditTimestamp(iso: string): string {
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

function AuditSeverityBadge({ severity }: { severity: AuditSeverity }) {
  const map: Record<AuditSeverity, { cls: string; icon: typeof FileText; label: string }> = {
    info: { cls: "bg-blue-50 text-blue-600", icon: FileText, label: "info" },
    success: { cls: "bg-emerald-50 text-emerald-600", icon: CheckCircle2, label: "success" },
    warning: { cls: "bg-amber-50 text-amber-600", icon: AlertTriangle, label: "warning" },
    danger: { cls: "bg-red-50 text-red-600", icon: XCircle, label: "danger" },
  };
  const { cls, icon: Icon, label } = map[severity];
  return (
    <span className={"inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold " + cls}>
      <Icon size={11} /> {label}
    </span>
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
