"use client";

// 화면 10: 신청서 작성 폼 — schema 기반 자동 렌더링.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, Upload } from "lucide-react";
import { api, type FormType } from "@/lib/api";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/formSchemas";
import { Breadcrumb } from "./Breadcrumb";

export function FormBuilder({ formType }: { formType: FormType }) {
  const router = useRouter();
  const schema = FORM_SCHEMAS[formType];
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const projectName = String(values[schema.projectField] || "(미입력)");
      const result = await api.submitForm({
        form_type: formType,
        project_name: projectName,
        payload: values,
      });
      router.push(`/governance/forms/submitted?id=${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "제작/활용 신청서 작성", href: "/governance/forms" },
          { label: schema.label },
        ]}
      />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{schema.label}</h1>
        <button
          form="form-builder"
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
        >
          <Save size={14} /> 저장
        </button>
      </div>

      <form id="form-builder" onSubmit={onSubmit} className="space-y-8">
        {schema.sections.map((section) => (
          <section key={section.title}>
            <div className="mb-3 flex items-center gap-2">
              <span className="block h-5 w-1 rounded-sm bg-brand" />
              <h2 className="text-base font-bold">{section.title}</h2>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <tbody>
                  {section.fields.map((f) => (
                    <tr key={f.key} className="border-b border-gray-100 last:border-b-0">
                      <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">
                        {f.label}
                        {f.required && <span className="ml-1 text-brand">*</span>}
                      </td>
                      <td className="px-5 py-3">
                        <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="block h-5 w-1 rounded-sm bg-brand" />
            <h2 className="text-base font-bold">파일 첨부</h2>
          </div>
          <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/30 px-6 py-10 text-center">
            <Upload size={20} className="mx-auto text-gray-400" />
            <p className="mt-2 text-sm font-semibold">파일을 드래그하거나 클릭하여 업로드하세요</p>
            <p className="mt-1 text-xs text-gray-500">샘플 데이터, 작업 가이드라인 등 첨부 가능 · 최대 50MB</p>
            <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold">
              📎 파일 선택
            </button>
          </div>
        </section>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Save size={14} /> 저장
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const common = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none";
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={common}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
        />
      );
    case "radio":
      return (
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.key}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="text-brand focus:ring-brand"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded text-brand focus:ring-brand"
          />
          <span className="text-gray-700">{field.label}</span>
        </label>
      );
    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={common}
        >
          <option value="">선택하세요</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
        />
      );
  }
}
