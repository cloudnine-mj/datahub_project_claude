"use client";

// 내 문서 목록 — 본인이 제출한 모든 신청서.
//
// request_no 가 같은 base ( '-vN' 접미사 제거한 값 ) 끼리 그룹핑.
// 그룹 안에서 가장 최근 row 1개만 메인 테이블에 노출하고, 나머지는 페이지
// 하단의 '수정 이력' 섹션에 정리해서 보여준다 — 화면 노이즈 감소.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, History } from "lucide-react";
import { api, type FormListItem, type FormStatus } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteFormButton } from "@/components/DeleteFormButton";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import { FORM_TYPE_LABELS, formatDate } from "@/lib/utils";

type StatusFilter = "all" | FormStatus;

/** '-vN' 접미사를 제거한 base request_no. 그룹 키로 사용. */
function getBaseRequestNo(rn: string): string {
  return rn.replace(/-v\d+$/, "");
}

export default function MyFormsPage() {
  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const refetch = useCallback(() => {
    api.listForms({ mine: true }).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // base request_no 별 그룹핑 → 최신 1개 + 나머지(수정 이력) 분리.
  const { latestItems, historyItems } = useMemo(() => {
    if (!items) return { latestItems: null as FormListItem[] | null, historyItems: [] as FormListItem[] };
    const byBase = new Map<string, FormListItem[]>();
    for (const it of items) {
      const base = getBaseRequestNo(it.request_no);
      const arr = byBase.get(base) ?? [];
      arr.push(it);
      byBase.set(base, arr);
    }
    const latest: FormListItem[] = [];
    const history: FormListItem[] = [];
    for (const [, group] of byBase) {
      group.sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      );
      latest.push(group[0]);
      history.push(...group.slice(1));
    }
    // 메인 리스트는 제출/수정 시각 역순
    latest.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    history.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    return { latestItems: latest, historyItems: history };
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

      {/* 수정 이력 — 같은 base request_no 의 이전 버전(들) 노출. 메인에 없는 것만. */}
      {historyItems.length > 0 && (
        <EditHistorySection items={historyItems} onChanged={refetch} />
      )}
    </div>
  );
}

function EditHistorySection({
  items,
  onChanged,
}: {
  items: FormListItem[];
  onChanged: () => void;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <History size={16} className="text-gray-500" />
        <h2 className="text-base font-bold tracking-tight">수정 이력</h2>
        <span className="text-xs text-gray-400">이전 버전 {items.length}건</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        같은 신청서의 이전 수정본입니다. 메인 목록에는 가장 최근 버전만 노출됩니다.
      </p>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">신청서 종류</th>
              <th className="px-6 py-3 font-medium">프로젝트명</th>
              <th className="w-28 px-6 py-3 font-medium">상태</th>
              <th className="w-32 px-6 py-3 font-medium">기록 시각</th>
              <th className="w-40 px-6 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-6 py-4 text-gray-500">{FORM_TYPE_LABELS[it.form_type]}</td>
                <td className="px-6 py-4">
                  <Link
                    href={`/governance/forms/detail/${it.id}?from=my`}
                    className="block hover:text-brand"
                  >
                    <div className="font-medium text-gray-700">{it.project_name}</div>
                    <div className="text-xs text-gray-400">{it.request_no}</div>
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={it.status} />
                </td>
                <td className="px-6 py-4 text-gray-500">{formatDate(it.submitted_at)}</td>
                <td className="px-6 py-4">
                  <DeleteFormButton
                    formId={it.id}
                    contextLabel={it.project_name}
                    onDeleted={onChanged}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
