"use client";

// 화면 10: 신청서 작성 폼 — schema 기반 자동 렌더링.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Save, Upload, X } from "lucide-react";
import { api, type FormType } from "@/lib/api";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/formSchemas";
import { Breadcrumb } from "./Breadcrumb";

const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FormBuilder({ formType }: { formType: FormType }) {
  const router = useRouter();
  const schema = FORM_SCHEMAS[formType];
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 신청자 정보 — 빈 상태로 시작, 사용자가 직접 입력.
  // 비워두면 백엔드가 로그인 사용자 정보로 fallback (안전망).
  const [submitterName, setSubmitterName] = useState("");
  const [submitterDepartment, setSubmitterDepartment] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");

  // 진행률 계산 — 신청자 정보(3) + schema 모든 필드.
  // 값이 비어있지 않으면 작성된 것으로 카운트 (boolean false 도 작성된 걸로 간주 X).
  // (변수명 'progress' 는 파일 업로드 메시지 useState 와 충돌하므로 'completion' 사용)
  const completion = useMemo(() => {
    const allFields = schema.sections.flatMap((s) => s.fields);
    const filledSchemaFields = allFields.filter((f) => {
      const v = values[f.key];
      if (v === undefined || v === null) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (typeof v === "boolean") return v === true;
      return true;
    }).length;
    const filledSubmitter = [submitterName, submitterDepartment, submitterEmail]
      .filter((s) => s.trim().length > 0).length;

    const total = allFields.length + 3; // +3 for submitter info
    const filled = filledSchemaFields + filledSubmitter;
    const percent = total > 0 ? Math.round((filled / total) * 100) : 0;

    // 섹션 진행 — '신청자 정보' 1개 + schema sections.
    const totalSections = schema.sections.length + 1;
    const startedSections =
      (filledSubmitter > 0 ? 1 : 0) +
      schema.sections.filter((s) => s.fields.some((f) => {
        const v = values[f.key];
        if (v === undefined || v === null) return false;
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "boolean") return v === true;
        return true;
      })).length;

    return { filled, total, percent, startedSections, totalSections };
  }, [values, submitterName, submitterDepartment, submitterEmail, schema]);

  function setField(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" 은(는) 50MB 를 초과합니다.`);
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const projectName = String(values[schema.projectField] || "(미입력)");
      setProgress("신청서 저장 중...");
      const result = await api.submitForm({
        form_type: formType,
        project_name: projectName,
        payload: values,
        submitter_name: submitterName || undefined,
        submitter_email: submitterEmail || undefined,
        submitter_department: submitterDepartment || undefined,
      });

      // 파일은 신청서 생성 후 순차 업로드 — 한 파일 실패해도 나머지 그대로 시도
      for (let i = 0; i < files.length; i++) {
        setProgress(`파일 업로드 중 (${i + 1}/${files.length}): ${files[i].name}`);
        try {
          await api.uploadFormAttachment(result.id, files[i]);
        } catch (e) {
          // 일부 파일만 실패해도 사용자에게 알리고 계속
          console.error(`업로드 실패 (${files[i].name}):`, e);
        }
      }

      router.push(`/governance/forms/submitted?id=${result.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "제작 / 활용 신청서 작성", href: "/governance/forms" },
          { label: schema.label },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{schema.label}</h1>

        {/* 진행률 안내 */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div className="inline-flex items-center gap-1.5 text-gray-600">
              Step{" "}
              <strong className="font-semibold text-gray-800">
                {completion.startedSections} / {completion.totalSections}
              </strong>
              <span className="text-gray-400">진행 중</span>
            </div>
            <span className="hidden text-gray-300 sm:inline">·</span>
            <div className="text-gray-600">
              <strong className="font-semibold text-gray-800">{completion.filled}</strong>
              <span className="text-gray-400"> / {completion.total} 필드</span>
            </div>
          </div>

          {/* progress bar */}
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[11px] font-semibold text-blue-600">
            {completion.percent}% 완료
          </div>
        </div>
      </div>

      <form id="form-builder" onSubmit={onSubmit} className="space-y-8">
        {/* 신청자 정보 — 기본은 로그인 사용자, 직접 수정 가능 */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="block h-5 w-1 rounded-sm bg-brand" />
            <h2 className="text-base font-bold">신청자 정보</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                <SubmitterInputRow
                  label="신청자 이름"
                  value={submitterName}
                  onChange={setSubmitterName}
                  placeholder="이름을 입력하세요"
                />
                <SubmitterInputRow
                  label="소속"
                  value={submitterDepartment}
                  onChange={setSubmitterDepartment}
                  placeholder="소속을 입력하세요"
                />
                <SubmitterInputRow
                  label="이메일"
                  value={submitterEmail}
                  onChange={setSubmitterEmail}
                  placeholder="이메일을 입력하세요"
                  type="email"
                />
              </tbody>
            </table>
          </div>
        </section>

        {schema.sections.map((section) => {
          // inlineWithNext 적용 — 두 필드를 같은 행에 묶기 위한 사전 그룹핑.
          type Row = { primary: FieldDef; inline?: FieldDef };
          const rows: Row[] = [];
          for (let i = 0; i < section.fields.length; i++) {
            const f = section.fields[i];
            if (f.inlineWithNext && i + 1 < section.fields.length) {
              rows.push({ primary: f, inline: section.fields[i + 1] });
              i++; // 다음 필드는 인라인으로 흡수됐으니 별도 행 X
            } else {
              rows.push({ primary: f });
            }
          }

          return (
            <section key={section.title}>
              <div className="mb-3 flex items-center gap-2">
                <span className="block h-5 w-1 rounded-sm bg-brand" />
                <h2 className="text-base font-bold">{section.title}</h2>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map(({ primary: f, inline }) => {
                      // 체크박스는 라벨이 input 옆에 이미 있으므로 좌측 라벨 셀 생략 (중복 방지)
                      if (f.type === "checkbox") {
                        return (
                          <tr key={f.key} className="border-b border-gray-100 last:border-b-0">
                            <td colSpan={2} className="px-5 py-3">
                              <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} />
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={f.key} className="border-b border-gray-100 last:border-b-0">
                          <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">
                            {f.label}
                          </td>
                          <td className="px-5 py-3">
                            {inline ? (
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} />
                                </div>
                                <span className="shrink-0 text-sm text-gray-600">{inline.label}</span>
                                <div className="flex-1">
                                  <FieldInput
                                    field={inline}
                                    value={values[inline.key]}
                                    onChange={(v) => setField(inline.key, v)}
                                  />
                                </div>
                              </div>
                            ) : (
                              <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} />
                            )}
                            {f.hint && <p className="mt-1.5 text-xs text-gray-500">💡 {f.hint}</p>}
                            {inline?.hint && <p className="mt-1.5 text-xs text-gray-500">💡 {inline.hint}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="block h-5 w-1 rounded-sm bg-brand" />
            <h2 className="text-base font-bold">파일 첨부</h2>
          </div>

          {/* 드래그&드롭 + 클릭 업로드 영역 */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={
              "cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition " +
              (dragActive ? "border-brand bg-brand/5" : "border-blue-300 bg-blue-50/30 hover:border-brand/60 hover:bg-blue-50/50")
            }
          >
            <Upload size={20} className="mx-auto text-gray-400" />
            <p className="mt-2 text-sm font-semibold">파일을 드래그하거나 클릭하여 업로드하세요</p>
            <p className="mt-1 text-xs text-gray-500">샘플 데이터, 작업 가이드라인 등 첨부 가능 · 최대 50MB</p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold">
              📎 파일 선택
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                e.target.value = "";  // 같은 파일 다시 선택 가능하게
              }}
            />
          </div>

          {/* 선택된 파일 목록 */}
          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-gray-400">📎</span>
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">{formatBytes(f.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                    aria-label="제거"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {progress && <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{progress}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Save size={14} /> {submitting ? "저장 중..." : "저장"}
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
        <div className="relative">
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={common + " appearance-none bg-white pr-9"}
          >
            <option value="">선택하세요</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>
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

function SubmitterInputRow({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email";
}) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">{label}</td>
      <td className="px-5 py-3">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </td>
    </tr>
  );
}
