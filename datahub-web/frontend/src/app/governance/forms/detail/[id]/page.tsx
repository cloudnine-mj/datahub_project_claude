// 화면 9: 데이터 구매 신청서 (read-only 상세). 모든 신청서 종류 공통 사용.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, CheckSquare, Database, Eye, Pencil, Square } from "lucide-react";
import { api, type EditHistoryEntry, type FieldChange, type FormDetail, type Me } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FormStatusPanel } from "@/components/FormStatusPanel";
import { FORM_TYPE_LABELS } from "@/lib/utils";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/formSchemas";

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    api.getForm(Number(params.id)).then(setForm).catch((e) => setError((e as Error).message));
  }, [params.id]);

  useEffect(() => {
    refetch();
    api.me().then(setMe).catch(() => setMe(null));
  }, [refetch]);

  if (error) return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!form) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  const schema = FORM_SCHEMAS[form.form_type];
  const label = FORM_TYPE_LABELS[form.form_type];
  const allFields = schema.sections.flatMap((s) => s.fields);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 거버넌스 문서 서식", href: "/governance/forms" },
          { label },
        ]}
      />

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
        <button className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
          <Eye size={12} /> 미리보기
        </button>
      </div>

      <FormStatusPanel
        formId={form.id}
        status={form.status}
        history={form.approval_history}
        me={me}
        submitterEmail={form.submitter_email}
        onChanged={refetch}
      />

      <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            <Row label="신청자 이름">{form.submitter_name}</Row>
            <Row label="소속">{form.submitter_department || "-"}</Row>
            <Row label="이메일">{form.submitter_email}</Row>
            {allFields.map((f) => {
              const v = form.payload[f.key];
              if (v === undefined || v === null || v === "") return null;
              return (
                <Row key={f.key} label={f.label}>
                  <FieldValue field={f} value={v} />
                </Row>
              );
            })}
          </tbody>
        </table>
      </div>

      {form.edit_history && form.edit_history.length > 0 && (
        <EditHistorySection history={form.edit_history} fieldLabels={fieldLabelMap(allFields)} />
      )}

      {form.attachments.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">첨부 파일 ({form.attachments.length})</h3>
          <ul className="space-y-2">
            {form.attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-gray-400">📎</span>
                  <span className="truncate font-medium">{a.filename}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {a.size_bytes < 1024
                      ? `${a.size_bytes} B`
                      : a.size_bytes < 1024 * 1024
                      ? `${(a.size_bytes / 1024).toFixed(1)} KB`
                      : `${(a.size_bytes / 1024 / 1024).toFixed(1)} MB`}
                  </span>
                </div>
                <a
                  href={api.formAttachmentUrl(form.id, a.id)}
                  className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/governance/forms/my"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
        >
          ☰ 내 문서 목록 보기
        </Link>
        <button
          onClick={() => router.push(`/governance/forms/${form.form_type}/new?id=${form.id}`)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
        >
          <Pencil size={12} /> 수정
        </button>
        <a
          href={api.exportFormUrl(form.id)}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
        >
          📄 Excel Export
        </a>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">{label}</td>
      <td className="px-5 py-3">{children}</td>
    </tr>
  );
}

/** payload key (예: 'API_사용_목적') → schema 의 사람이 읽을 라벨 매핑. */
function fieldLabelMap(fields: FieldDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) if (f.label) out[f.key] = f.label;
  return out;
}

/**
 * 수정 이력 섹션 — 최신 수정이 위로. 각 row 클릭 시 변경된 필드 diff 펼침/접기.
 */
function EditHistorySection({
  history,
  fieldLabels,
}: {
  history: EditHistoryEntry[];
  fieldLabels: Record<string, string>;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const reversed = [...history].reverse();

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50/40 px-5 py-3">
        <h3 className="text-sm font-bold">수정 이력 ({history.length})</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {reversed.map((e, i) => {
          const open = openIdx === i;
          const count = e.changes?.length ?? 0;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  {open ? (
                    <ChevronDown size={14} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                  <Pencil size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-800">{e.edited_by}</span>
                  <span className="text-gray-500">님이 수정함</span>
                  <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    {count}개 필드
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(e.edited_at).toLocaleString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>
              {open && count > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-3">
                  <ul className="space-y-2">
                    {e.changes.map((c, ci) => (
                      <ChangeRow key={ci} change={c} fieldLabels={fieldLabels} />
                    ))}
                  </ul>
                </div>
              )}
              {open && count === 0 && (
                <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-3 text-xs text-gray-400">
                  변경 내역이 기록되지 않았습니다.
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChangeRow({
  change,
  fieldLabels,
}: {
  change: FieldChange;
  fieldLabels: Record<string, string>;
}) {
  const label = fieldLabels[change.field] ?? change.field;
  return (
    <li className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        <DiffCell label="변경 전" value={change.before} variant="before" />
        <DiffCell label="변경 후" value={change.after} variant="after" />
      </div>
    </li>
  );
}

function DiffCell({
  label,
  value,
  variant,
}: {
  label: string;
  value: unknown;
  variant: "before" | "after";
}) {
  const formatted = formatDiffValue(value);
  const empty = formatted === "" || formatted === "—";
  const styles =
    variant === "before"
      ? "border-red-100 bg-red-50/40 text-red-900"
      : "border-emerald-100 bg-emerald-50/40 text-emerald-900";
  return (
    <div className={"rounded border px-2.5 py-1.5 " + styles}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap break-words text-xs">
        {empty ? <span className="text-gray-400">—</span> : formatted}
      </div>
    </div>
  );
}

/** diff 값을 사람이 보기 좋은 문자열로 변환. 알려진 패턴 우선, 그 외만 JSON fallback. */
function formatDiffValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    // service_blocks (객체 배열) — service_name 키로 휴리스틱 감지
    if (v.length > 0 && typeof v[0] === "object" && v[0] !== null && "service_name" in (v[0] as object)) {
      return formatServiceBlocks(v as Record<string, unknown>[]);
    }
    // 단순 문자열 배열 (예: service_list)
    if (v.every((x) => typeof x === "string")) return v.join(", ") || "—";
    return JSON.stringify(v, null, 2);
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("start" in o || "end" in o) return `${o.start ?? "?"} ~ ${o.end ?? "?"}`;
    if ("kind" in o) {
      if (o.kind === "기타") return `기타(${o.custom ?? "-"})`;
      return String(o.kind ?? "—");
    }
    return JSON.stringify(v, null, 2);
  }
  return String(v);
}

/** 업무생산성 도구 신청서 service_blocks — 각 블록을 줄단위 요약. */
function formatServiceBlocks(blocks: Record<string, unknown>[]): string {
  if (blocks.length === 0) return "—";
  return blocks
    .map((b, i) => {
      const lines: string[] = [];
      if (b.service_name) lines.push(`서비스명: ${b.service_name}`);
      if (b.usage) lines.push(`활용 방안: ${b.usage}`);
      const cur = b.currency as { kind?: string; custom?: string } | undefined;
      if (cur?.kind) {
        const display = cur.kind === "기타" ? `기타(${cur.custom ?? "-"})` : cur.kind;
        lines.push(`결제 통화: ${display}`);
      }
      const cost = b.cost as string | undefined;
      if (cost) {
        const sym = cur?.kind === "USD" ? "$" : cur?.kind === "KRW" ? "₩" : "";
        lines.push(`예상 비용: ${sym}${cost}`);
      }
      if (b.payment_method) lines.push(`결제 방식: ${b.payment_method}`);
      const members = b.members as string[] | undefined;
      if (Array.isArray(members) && members.length > 0) {
        lines.push(`사용자: ${members.join(", ")} (${members.length}명)`);
      }
      const body = lines.length > 0 ? lines.map((l) => `  ${l}`).join("\n") : "  (빈 서비스)";
      return `▸ 서비스 ${i + 1}\n${body}`;
    })
    .join("\n\n");
}

/**
 * 신청서 값을 필드 타입/키에 따라 의미있는 형태로 렌더링.
 *
 *  - radio (옵션 있음) : 모든 옵션을 체크박스로 표시 (선택된 쪽만 채워진 박스)
 *  - 레포지토리 키워드  : 데이터베이스 아이콘 + 칩 형태
 *  - boolean           : ☑ 확인 완료 / 확인 필요
 *  - 그 외             : 일반 텍스트 (whitespace 보존)
 */
function FieldValue({ field, value }: { field: FieldDef; value: unknown }) {
  if (field.type === "radio" && field.options && field.options.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-5">
        {field.options.map((opt) => {
          const selected = value === opt;
          const Icon = selected ? CheckSquare : Square;
          return (
            <span key={opt} className="inline-flex items-center gap-1.5 text-sm">
              <Icon
                size={16}
                className={selected ? "text-blue-500" : "text-gray-300"}
                strokeWidth={selected ? 2.5 : 1.5}
              />
              <span className={selected ? "text-gray-900" : "text-gray-500"}>{opt}</span>
            </span>
          );
        })}
      </div>
    );
  }

  if (
    field.key.includes("레포지토리") ||
    field.key.toLowerCase().includes("repo")
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700">
        <Database size={13} className="text-gray-500" />
        {String(value)}
      </span>
    );
  }

  if (typeof value === "boolean") {
    return <span>{value ? "✅ 확인 완료" : "확인 필요"}</span>;
  }

  if (field.type === "service_list" && Array.isArray(value)) {
    const items = (value as string[]).filter((s) => s && s.trim().length > 0);
    if (items.length === 0) return <span className="text-gray-400">-</span>;
    return (
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-sm">
            <span className="text-xs text-gray-500">서비스명 {i + 1}</span>
            <span className="ml-2">{s}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (field.type === "date_range" && value && typeof value === "object") {
    const v = value as { start?: string; end?: string };
    if (!v.start && !v.end) return <span className="text-gray-400">-</span>;
    return (
      <span>
        {v.start || "?"} ~ {v.end || "?"}
      </span>
    );
  }

  if (field.type === "currency" && value && typeof value === "object") {
    const v = value as { kind?: string; custom?: string };
    if (v.kind === "기타") return <span>기타 ({v.custom || "-"})</span>;
    return <span>{v.kind || "-"}</span>;
  }

  if (field.type === "service_blocks" && Array.isArray(value)) {
    type Block = {
      service_name?: string;
      usage?: string;
      currency?: { kind?: string; custom?: string };
      cost?: string;
      payment_method?: string;
      members?: string[];
    };
    const blocks = (value as Block[]).filter((b) => b && (b.service_name || b.usage || b.cost));
    if (blocks.length === 0) return <span className="text-gray-400">-</span>;
    return (
      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-gray-50/40 px-3 py-2 text-sm">
            <div className="font-semibold text-gray-900">
              서비스 {i + 1}{b.service_name ? ` · ${b.service_name}` : ""}
            </div>
            {b.usage && <div className="mt-1 text-gray-700">{b.usage}</div>}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
              {b.cost && <span>비용: {b.cost}</span>}
              {b.currency?.kind && (
                <span>
                  통화: {b.currency.kind === "기타" ? `기타(${b.currency.custom || "-"})` : b.currency.kind}
                </span>
              )}
              {b.payment_method && <span>결제: {b.payment_method}</span>}
              {b.members && b.members.length > 0 && (
                <span>인원: {b.members.length}명 ({b.members.join(", ")})</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}
