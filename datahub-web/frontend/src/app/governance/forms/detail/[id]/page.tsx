// 화면 9: 데이터 구매 신청서 (read-only 상세). 모든 신청서 종류 공통 사용.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckSquare, Database, Eye, Pencil, Send, Square, X } from "lucide-react";
import { api, type FormDetail, type Me } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FormStatusPanel } from "@/components/FormStatusPanel";
import { FORM_TYPE_LABELS } from "@/lib/utils";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/formSchemas";
import { findFirstEmptyRequired } from "@/lib/formValidation";

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justEdited = searchParams?.get("just-edited") === "1";
  // 진입 출처 — 브레드크럼 부모를 어디로 표시할지 결정.
  //   from=my    → '내 문서 목록'
  //   from=admin → '신청서 관리'
  //   기본        → '데이터 거버넌스 문서 서식 모음' (서식 선택 화면에서 들어온 경우)
  const from = searchParams?.get("from");
  const [form, setForm] = useState<FormDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [missingField, setMissingField] = useState<string | null>(null);

  const refetch = useCallback(() => {
    api.getForm(Number(params.id)).then(setForm).catch((e) => setError((e as Error).message));
  }, [params.id]);

  async function submitDraft() {
    if (!form) return;
    setError(null);

    // 정식 제출 검증 — FormBuilder 와 동일 규칙 (필수 섹션 / 비-checkbox 필드)
    const schema = FORM_SCHEMAS[form.form_type];
    const missing = findFirstEmptyRequired(schema, form.payload, {
      submitterName: form.submitter_name || "",
      submitterDepartment: form.submitter_department || "",
      submitterEmail: form.submitter_email || "",
    });
    if (missing) {
      setMissingField(missing);
      return;
    }

    setSubmitting(true);
    try {
      await api.updateForm(form.id, {
        form_type: form.form_type,
        project_name: form.project_name,
        payload: form.payload,
        status: "submitted",
        submitter_name: form.submitter_name,
        submitter_email: form.submitter_email,
        submitter_department: form.submitter_department ?? undefined,
      });
      // 내 문서 목록 등 다른 페이지의 Router Cache 무효화
      router.refresh();
      router.push(`/governance/forms/submitted?id=${form.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

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
          from === "my"
            ? { label: "내 문서 목록", href: "/governance/forms/my" }
            : from === "admin"
            ? { label: "신청서 관리", href: "/governance/admin/forms" }
            : { label: "데이터 거버넌스 문서 서식 모음", href: "/governance/forms" },
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
          onClick={() => router.push(`/governance/forms/${form.form_type}/new?id=${form.id}${from ? `&from=${from}` : ""}`)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
        >
          <Pencil size={12} /> 수정
        </button>
        {form.status === "draft" && justEdited && (
          <button
            type="button"
            onClick={submitDraft}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            <Send size={12} /> {submitting ? "제출 중..." : "제출"}
          </button>
        )}
      </div>

      {missingField && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setMissingField(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-amber-600">
                  <AlertCircle size={18} />
                </span>
                <h3 className="text-base font-bold">필수 항목 누락</h3>
              </div>
              <button
                type="button"
                onClick={() => setMissingField(null)}
                aria-label="닫기"
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              <strong className="font-semibold text-gray-800">&apos;{missingField}&apos;</strong> 항목을 입력해주세요. 신청서를 수정한 뒤 다시 제출해 주세요.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMissingField(null)}
                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setMissingField(null);
                  if (form) router.push(`/governance/forms/${form.form_type}/new?id=${form.id}${from ? `&from=${from}` : ""}`);
                }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                수정하러 가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discussions(댓글 스레드) — 일단 제외. 백엔드와 FormCommentSection 컴포넌트는 그대로 유지.
          재노출이 필요해지면 아래 한 줄 복구:
          <FormCommentSection formId={form.id} me={me} /> */}
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
