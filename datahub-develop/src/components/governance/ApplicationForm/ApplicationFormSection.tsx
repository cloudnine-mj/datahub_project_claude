// 신청서 작성 양식 섹션 — 빨간 세로 막대 + 제목 + 필수/선택 표시 + 필드 row 리스트.
//   FORM_SCHEMAS 의 SectionDef / FieldDef 를 받아 커스텀 디자인으로 렌더.
//   지원 type: text / textarea / date / number / select / radio / checkbox / approver_list.
//   미지원 type(service_blocks 등) 은 textarea 로 fallback — 추후 필요 시 확장.

"use client";

import { useState, type KeyboardEvent } from "react";
import { AlertCircle, Info, X } from "lucide-react";
import type { FieldDef, SectionDef } from "@/lib/governance/forms/schemas";
import { DateField } from "@/components/governance/DateField";
import { NumberInput } from "@/components/governance/NumberInput";

interface Props {
  section: SectionDef;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

export function ApplicationFormSection({
  section,
  values,
  onChange,
  disabled = false,
}: Props) {
  // inlineWithNext 적용 — 같은 행에 묶을 두 필드를 사전 그룹핑.
  // 결과 배열은 [field] | [field, nextField] 의 시퀀스.
  const groups: FieldDef[][] = [];
  for (let i = 0; i < section.fields.length; i++) {
    const f = section.fields[i];
    if (f.inlineWithNext && i + 1 < section.fields.length) {
      groups.push([f, section.fields[i + 1]]);
      i++;
    } else {
      groups.push([f]);
    }
  }

  const isTable = section.layout === "table";

  return (
    <section className="border-t border-gray-100 pt-5 first:border-t-0 first:pt-0 dark:border-gray-800">
      <header className="mb-4 flex items-center gap-2">
        <span aria-hidden="true" className="block h-4 w-[3px] rounded-sm bg-brand" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          {section.title}
        </h3>
        {section.optional ? (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">(선택)</span>
        ) : (
          <span aria-hidden="true" className="text-brand">*</span>
        )}
      </header>

      {isTable ? (
        // 표 레이아웃 — 라벨(240px 회색) + 입력(1fr 흰색), 행 사이 구분선.
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          {groups.map((group, idx) => (
            <TableRow
              key={group[0].key}
              fields={group}
              values={values}
              onChange={onChange}
              disabled={disabled}
              isLast={idx === groups.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3.5">
          {section.fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key]}
              onChange={(v) => onChange(f.key, v)}
              disabled={disabled}
              // 섹션 헤더에 이미 * 가 있으면(필수 섹션) 필드 레벨 * 는 숨김.
              // 선택 섹션에서 특정 필드만 required 인 경우에만 필드 * 노출.
              hideRequiredMark={!section.optional}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** 표 레이아웃의 한 행 — 단일 필드 또는 inlineWithNext 로 묶인 두 필드.
 *  checkbox 는 체크박스 + label(긴 안내문) 을 값 칸 안에 인라인으로 렌더하고
 *  라벨 칸은 tableLabel 로 짧게 표시. */
function TableRow({
  fields,
  values,
  onChange,
  disabled,
  isLast,
}: {
  fields: FieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, v: unknown) => void;
  disabled: boolean;
  isLast: boolean;
}) {
  const primary = fields[0];
  const isTallTextarea = primary.type === "textarea";
  const isCheckbox = primary.type === "checkbox";
  const borderCls = isLast ? "" : "border-b border-gray-200 dark:border-gray-700";
  const rowLabel = primary.tableLabel ?? primary.label;

  // checkbox 행 — 양쪽 padding 16px 로 라벨 칸과 동일한 시각 정렬.
  if (isCheckbox) {
    const checked = !!values[primary.key];
    return (
      <div className={`grid grid-cols-[240px_1fr] ${borderCls}`}>
        <div className="flex items-center bg-gray-50 px-4 py-4 text-[12px] text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
          {rowLabel}
        </div>
        <label
          htmlFor={primary.key}
          className="flex cursor-pointer items-center gap-2 px-4 py-4"
        >
          <input
            id={primary.key}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(primary.key, e.target.checked)}
            disabled={disabled}
            className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand focus:ring-brand"
          />
          <span className="text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
            {primary.label}
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-[240px_1fr] ${borderCls}`}>
      <div
        className={`bg-gray-50 px-4 py-3.5 text-[12px] text-gray-500 dark:bg-gray-800/40 dark:text-gray-400 ${
          isTallTextarea ? "items-start pt-4" : "items-center"
        } flex`}
      >
        {rowLabel}
      </div>
      <div className={`flex ${isTallTextarea ? "items-start" : "items-center"} gap-2.5 px-3.5 py-3`}>
        {fields.length === 1 ? (
          // date 만 폭 제한 — 그 외는 가로 전체.
          <div className={primary.type === "date" ? "w-full max-w-[200px]" : "w-full"}>
            <FieldInput
              field={primary}
              value={values[primary.key]}
              onChange={(v) => onChange(primary.key, v)}
              disabled={disabled}
            />
          </div>
        ) : (
          // inlineWithNext — 수량 + 단위 처럼 한 행에 두 필드.
          <>
            <div className="w-[160px] shrink-0">
              <FieldInput
                field={primary}
                value={values[primary.key]}
                onChange={(v) => onChange(primary.key, v)}
                disabled={disabled}
              />
            </div>
            <span className="text-[12px] text-gray-500 dark:text-gray-400">
              {fields[1].label}
            </span>
            <div className="w-[160px] shrink-0">
              <FieldInput
                field={fields[1]}
                value={values[fields[1].key]}
                onChange={(v) => onChange(fields[1].key, v)}
                disabled={disabled}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  disabled,
  hideRequiredMark,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
  hideRequiredMark: boolean;
}) {
  const showRequired = field.required && !hideRequiredMark;

  // 체크박스는 라벨이 길어서(체크리스트 안내문) 별도 가로 레이아웃: 체크박스 + 인라인 라벨.
  if (field.type === "checkbox") {
    return (
      <label
        htmlFor={field.key}
        className="flex cursor-pointer items-start gap-2.5 py-1"
      >
        <input
          id={field.key}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand focus:ring-brand"
        />
        <span className="text-[13px] leading-relaxed text-gray-800 dark:text-gray-200">
          {field.label}
          {showRequired && (
            <span aria-hidden="true" className="ml-0.5 text-brand">
              *
            </span>
          )}
        </span>
      </label>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <label
        htmlFor={field.key}
        className="pt-1.5 text-[13px] text-gray-500 dark:text-gray-400"
      >
        {field.label}
        {showRequired && (
          <span aria-hidden="true" className="ml-0.5 text-brand">
            *
          </span>
        )}
      </label>
      <div>
        <FieldInput field={field} value={value} onChange={onChange} disabled={disabled} />
        {field.hint && <FieldHint field={field} value={value} />}
      </div>
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-[13px] focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800/60";

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
}) {
  const id = field.key;

  if (field.type === "textarea") {
    // rows 에 따라 min-height 차등 — 예상 답변 길이를 시각적으로 암시.
    //   2 → 64px (중간 서술), 3 → 90px (긴 서술), 미지정 → 70px (기본).
    const minH =
      field.rows === 2 ? "min-h-[64px]" : field.rows === 3 ? "min-h-[90px]" : "min-h-[70px]";
    return (
      <textarea
        id={id}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        rows={field.rows}
        className={`${INPUT_BASE} ${minH} resize-y`}
      />
    );
  }

  if (field.type === "date") {
    return (
      <DateField
        id={id}
        value={(value as string) ?? ""}
        onChange={(v) => onChange(v)}
        disabled={disabled}
      />
    );
  }

  if (field.type === "number") {
    return (
      <NumberInput
        id={id}
        value={(value as string | number) ?? ""}
        onChange={(_n, raw) => onChange(raw)}
        placeholder={field.placeholder}
        disabled={disabled}
        className={INPUT_BASE}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        id={id}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={INPUT_BASE}
      >
        <option value="">선택</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    const current = (value as string) ?? "";
    return (
      <div className="flex flex-wrap gap-3 py-1.5">
        {(field.options ?? []).map((opt) => (
          <label
            key={opt}
            className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-gray-800 dark:text-gray-200"
          >
            <input
              type="radio"
              name={id}
              value={opt}
              checked={current === opt}
              onChange={() => onChange(opt)}
              disabled={disabled}
              className="h-3.5 w-3.5 text-brand focus:ring-brand"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="inline-flex cursor-pointer items-center gap-2 py-1 text-[13px] text-gray-800 dark:text-gray-200">
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
        />
        {field.placeholder ?? ""}
      </label>
    );
  }

  if (field.type === "approver_list") {
    return (
      <ApproverListInput
        id={id}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
        placeholder={field.placeholder}
        disabled={disabled}
      />
    );
  }

  // text / 미지원 type fallback
  return (
    <input
      id={id}
      type="text"
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
      className={INPUT_BASE}
    />
  );
}

function ApproverListInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft("");
  };
  const remove = (name: string) => onChange(value.filter((n) => n !== name));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // 한글(IME) 조합 중 Enter 는 글자 확정 용도 — 칩으로 추가하지 않음.
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[12px] text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            >
              {n}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(n)}
                  aria-label={`${n} 제거`}
                  className="rounded-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        disabled={disabled}
        className={INPUT_BASE}
      />
    </div>
  );
}

function FieldHint({ field, value }: { field: FieldDef; value: unknown }) {
  // hintWhen 조건 — 특정 값일 때만 노출.
  if (field.hintWhen !== undefined) {
    const want = Array.isArray(field.hintWhen) ? field.hintWhen : [field.hintWhen];
    if (typeof value !== "string" || !want.includes(value)) return null;
  }
  if (!field.hint) return null;

  const link = field.hintLink;
  const hint = field.hint;
  const hasToken = hint.includes("{link}") && link;
  const tone = field.hintTone ?? "gray";

  const body = hasToken && link ? (
    <>
      {hint.split("{link}")[0]}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:opacity-80"
      >
        {link.label}
      </a>
      {hint.split("{link}")[1]}
    </>
  ) : (
    <>
      {hint}
      {link && (
        <>
          {" "}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {link.label}
          </a>
        </>
      )}
    </>
  );

  if (tone === "amber") {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-900/30">
        <AlertCircle
          size={13}
          aria-hidden="true"
          className="mt-px shrink-0 text-amber-800 dark:text-amber-300"
        />
        <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">{body}</p>
      </div>
    );
  }
  if (tone === "info") {
    return (
      <div className="mt-2 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-950/40">
        <Info
          size={13}
          aria-hidden="true"
          className="mt-px shrink-0 text-blue-700 dark:text-blue-300"
        />
        <p className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">{body}</p>
      </div>
    );
  }
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{body}</p>
  );
}
