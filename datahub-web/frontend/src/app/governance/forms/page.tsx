// 화면 5: 제작/활용 신청서 작성 — 5개 양식 카드 + 내 문서 목록
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { api, type FormListItem, type FormStatus } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteFormButton } from "@/components/DeleteFormButton";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import { FORM_TYPE_LABELS, formatDate } from "@/lib/utils";
import { FORM_SCHEMAS } from "@/lib/formSchemas";

const TYPES = Object.values(FORM_SCHEMAS).map((s) => s.type);

type StatusFilter = "all" | FormStatus;

export default function FormsIndexPage() {
  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const refetch = useCallback(() => {
    api.listForms({ mine: true }).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return filter === "all" ? items : items.filter((it) => it.status === filter);
  }, [items, filter]);

  // 각 status 별 건수 — 필터 칩에 카운터 노출
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 };
    for (const it of items ?? []) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "제작/활용 신청서 작성" }]} />
      <h1 className="text-3xl font-bold tracking-tight">제작/활용 신청서 작성</h1>
      <p className="mt-2 text-sm text-gray-500">
        작성할 품의서 종류를 선택하세요. 작성 완료 후 전자결재를 통해 신청을 완료해 주세요.
      </p>

      <div className="mt-6 space-y-3">
        {TYPES.map((t) => {
          const schema = FORM_SCHEMAS[t];
          return (
            <Link
              key={t}
              href={`/governance/forms/${t}/new`}
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 transition hover:border-brand/40 hover:shadow-sm"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <FileText size={18} className="mt-0.5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{FORM_TYPE_LABELS[t]}</div>
                  {schema.description && (
                    <p className="mt-1 text-xs text-gray-500">{schema.description}</p>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </Link>
          );
        })}
      </div>

      <div className="mt-12 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">내 문서 목록</h2>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            전체 {counts.all > 0 && <span className="ml-1 text-gray-400">({counts.all})</span>}
          </FilterChip>
          {STATUSES.map((s) => (
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
      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
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
                  {items && items.length > 0
                    ? "선택한 상태의 신청서가 없습니다."
                    : "제출한 신청서가 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.map((it) => (
                <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">{FORM_TYPE_LABELS[it.form_type]}</td>
                  <td className="px-6 py-4">
                    <Link href={`/governance/forms/detail/${it.id}`} className="block hover:text-brand">
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
                        📄 Excel
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
