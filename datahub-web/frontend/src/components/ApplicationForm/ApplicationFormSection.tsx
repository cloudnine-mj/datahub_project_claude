// 양식 섹션 — 빨간 세로 막대 + 제목 + 필수 표시 + 필드 row 리스트.
//   각 row 는 grid 120px 1fr (모바일은 stack).
//   필드 타입별 분기 렌더: input / textarea / disabled / date-range / number-with-unit / file.

"use client";

import { Upload } from "lucide-react";
import type { FormFieldDef, FormSectionDef } from "@/lib/applicationFormConfig";

interface Props {
  section: FormSectionDef;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
}

export function ApplicationFormSection({
  section,
  values,
  onChange,
  disabled = false,
}: Props) {
  return (
    <section className="border-t border-gray-100 pt-5 first:border-t-0 first:pt-0 dark:border-gray-800">
      <header className="mb-4 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="block h-4 w-[3px] rounded-sm bg-brand"
        />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          {section.title}
        </h3>
        {section.required ? (
          <span aria-hidden="true" className="text-brand">*</span>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">(선택)</span>
        )}
      </header>

      <div className="space-y-3.5">
        {section.fields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            value={values[f.id] ?? ""}
            onChange={(v) => onChange(f.id, v)}
            disabled={disabled}
            required={section.required && f.type !== "disabled" && f.type !== "file"}
          />
        ))}
      </div>
    </section>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  disabled,
  required,
}: {
  field: FormFieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  required: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[120px_1fr] sm:gap-3">
      <label
        htmlFor={field.id}
        className="pt-1.5 text-[13px] text-gray-500 dark:text-gray-400"
      >
        {field.label}
      </label>
      <div>
        <FieldInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
        />
        {field.helperText && (
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {field.helperText}
          </p>
        )}
      </div>
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-[13px] focus:border-brand focus:outline-none disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

const DISABLED_BG =
  "bg-gray-50 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400";

function FieldInput({
  field,
  value,
  onChange,
  disabled,
  required,
}: {
  field: FormFieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  required: boolean;
}) {
  const commonProps = {
    id: field.id,
    disabled,
    "aria-required": required ? true : undefined,
  };

  if (field.type === "textarea") {
    return (
      <textarea
        {...commonProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`${INPUT_BASE} min-h-[70px] resize-y ${
          disabled ? DISABLED_BG : ""
        }`}
      />
    );
  }

  if (field.type === "disabled") {
    return (
      <input
        {...commonProps}
        type="text"
        value={value}
        readOnly
        disabled
        className={`${INPUT_BASE} ${DISABLED_BG}`}
      />
    );
  }

  if (field.type === "date-range") {
    const [start, end] = (value || "~").split("~");
    const update = (which: "start" | "end", v: string) => {
      const next = which === "start" ? `${v}~${end ?? ""}` : `${start ?? ""}~${v}`;
      onChange(next);
    };
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input
          type="date"
          value={start ?? ""}
          onChange={(e) => update("start", e.target.value)}
          disabled={disabled}
          aria-label="착수일"
          placeholder="착수일"
          className={`${INPUT_BASE} ${disabled ? DISABLED_BG : ""}`}
        />
        <span aria-hidden="true" className="text-gray-400 dark:text-gray-500">
          ~
        </span>
        <input
          type="date"
          value={end ?? ""}
          onChange={(e) => update("end", e.target.value)}
          disabled={disabled}
          aria-label="완료일"
          placeholder="완료일"
          className={`${INPUT_BASE} ${disabled ? DISABLED_BG : ""}`}
        />
      </div>
    );
  }

  if (field.type === "number-with-unit") {
    return (
      <div className="flex items-center gap-2">
        <input
          {...commonProps}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${INPUT_BASE} ${disabled ? DISABLED_BG : ""}`}
        />
        {field.unit && (
          <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400">
            {field.unit}
          </span>
        )}
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <button
        type="button"
        onClick={() => console.log("[stub] 파일 선택", field.id)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <Upload size={13} aria-hidden="true" />
        파일 선택
      </button>
    );
  }

  // input (default)
  return (
    <input
      {...commonProps}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={`${INPUT_BASE} ${disabled ? DISABLED_BG : ""}`}
    />
  );
}
