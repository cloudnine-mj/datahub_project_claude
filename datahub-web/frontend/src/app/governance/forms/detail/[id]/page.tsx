// 화면 9: 데이터 구매 신청서 (read-only 상세). 모든 신청서 종류 공통 사용.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import { api, type FormDetail } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FORM_TYPE_LABELS } from "@/lib/utils";
import { FORM_SCHEMAS } from "@/lib/formSchemas";

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getForm(Number(params.id)).then(setForm).catch((e) => setError((e as Error).message));
  }, [params.id]);

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
          { label: "제작/활용 신청서", href: "/governance/forms" },
          { label },
        ]}
      />

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
        <button className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">
          <Eye size={12} /> 미리보기
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            <Row label="신청자 이름" value={form.submitter_name} />
            <Row label="소속" value={form.submitter_department || "-"} />
            <Row label="이메일" value={form.submitter_email} />
            <Row label="신청번호" value={form.request_no} />
            {allFields.map((f) => {
              const v = form.payload[f.key];
              if (v === undefined || v === null || v === "") return null;
              const display = typeof v === "boolean" ? (v ? "✅ 확인 완료" : "확인 필요") : String(v);
              return <Row key={f.key} label={f.label} value={display} />;
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Link
          href="/governance/forms"
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">{label}</td>
      <td className="px-5 py-3">{value}</td>
    </tr>
  );
}
