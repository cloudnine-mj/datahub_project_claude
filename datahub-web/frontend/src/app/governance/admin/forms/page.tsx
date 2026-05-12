"use client";

// 관리자 전용 — 모든 사용자의 신청서 검토 / 승인 / 반려 진입점.
// admin 이 아니면 권한 없음 안내. 기존 detail 페이지의 진행 상태 패널에서 액션 수행.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, Lock, Play, X as XIcon } from "lucide-react";
import { api, type FormListItem, type FormStatus, type Me } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteFormButton } from "@/components/DeleteFormButton";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import { FORM_TYPE_LABELS, formatDate } from "@/lib/utils";

type StatusFilter = "all" | FormStatus;

export default function AdminFormsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<FormListItem[] | null>(null);
  // 기본 필터를 "검토 대기" — 제출됨/검토 중 우선 표시
  const [filter, setFilter] = useState<StatusFilter>("submitted");

  const refetch = useCallback(() => {
    api.listForms({ mine: false }).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    refetch();
  }, [refetch]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return filter === "all" ? items : items.filter((it) => it.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 };
    for (const it of items ?? []) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  const [actionError, setActionError] = useState<string | null>(null);

  async function changeStatus(formId: number, next: FormStatus) {
    setActionError(null);
    try {
      await api.changeFormStatus(formId, { status: next });
      refetch();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

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
        items={[{ label: "Governance", href: "/governance" }, { label: "신청서 관리" }]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">신청서 관리</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            전체 사용자의 신청서를 검토 / 승인 / 반려할 수 있습니다. 표에서 바로 처리하거나, 프로젝트명을 눌러 상세 페이지에서 코멘트와 함께 처리할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            전체 {counts.all > 0 && <span className="ml-1 text-gray-400">({counts.all})</span>}
          </FilterChip>
          {STATUSES.filter((s) => s.value !== "rejected").map((s) => (
            <FilterChip key={s.value} active={filter === s.value} onClick={() => setFilter(s.value)}>
              {s.label}
              {(counts[s.value] ?? 0) > 0 && (
                <span className="ml-1 text-gray-400">({counts[s.value]})</span>
              )}
            </FilterChip>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">신청서 종류</th>
              <th className="px-6 py-3 font-medium">프로젝트명</th>
              <th className="w-32 px-6 py-3 font-medium">신청자</th>
              <th className="w-28 px-6 py-3 font-medium">상태</th>
              <th className="w-32 px-6 py-3 font-medium">제출일</th>
              <th className="w-64 px-6 py-3 font-medium">검토</th>
              <th className="w-40 px-6 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered === null ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  {items && items.length > 0
                    ? "선택한 상태의 신청서가 없습니다."
                    : "제출된 신청서가 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.map((it) => (
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
                  <td className="px-6 py-4 text-gray-500">{formatDate(it.submitted_at)}</td>
                  <td className="px-6 py-4">
                    <InlineReviewActions
                      item={it}
                      me={me}
                      onAction={(next) => changeStatus(it.id, next)}
                    />
                  </td>
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
    </div>
  );
}

/**
 * 신청서 행 인라인 검토 버튼.
 *   submitted   → 검토 시작 / 승인 / 반려
 *   reviewing   → 승인 / 반려
 *   그 외        → '-'
 * 자기 결재 방지: 본인이 제출한 신청서면 액션 숨김.
 */
function InlineReviewActions({
  item,
  me,
  onAction,
}: {
  item: FormListItem;
  me: Me | null;
  onAction: (next: FormStatus) => void;
}) {
  const isOwn = !!me && item.submitter_id === me.user.id;

  if (isOwn) {
    return (
      <span className="text-xs text-gray-400" title="본인이 제출한 신청서는 처리할 수 없습니다">
        본인 제출
      </span>
    );
  }

  const status = item.status;
  if (status !== "submitted" && status !== "reviewing") {
    return <span className="text-xs text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {status === "submitted" && (
        <ActionButton
          tone="amber"
          icon={Play}
          label="검토 시작"
          onClick={() => onAction("reviewing")}
        />
      )}
      <ActionButton
        tone="emerald"
        icon={Check}
        label="승인"
        onClick={() => onAction("approved")}
      />
      <ActionButton tone="red" icon={XIcon} label="반려" onClick={() => onAction("rejected")} />
    </div>
  );
}

function ActionButton({
  tone,
  icon: Icon,
  label,
  onClick,
}: {
  tone: "amber" | "emerald" | "red";
  icon: typeof Play;
  label: string;
  onClick: () => void;
}) {
  const cls =
    tone === "amber"
      ? "bg-amber-500 hover:bg-amber-600"
      : tone === "emerald"
      ? "bg-emerald-500 hover:bg-emerald-600"
      : "bg-red-500 hover:bg-red-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold text-white " +
        cls
      }
    >
      <Icon size={11} /> {label}
    </button>
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
