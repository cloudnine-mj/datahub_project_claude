/**
 * 신청 양식 필수 필드 검증 — FormBuilder 의 '제출' / detail 페이지의 '제출' 버튼 양쪽에서 사용.
 *
 * 정식 제출(submitted) 시 첫번째 비어있는 필수 필드의 라벨을 반환.
 * 모두 채워졌으면 null. optional: true 섹션과 checkbox 필드는 검증에서 제외.
 */

import type { FieldDef, FormSchema } from "./formSchemas";

export function findFirstEmptyRequired(
  schema: FormSchema,
  values: Record<string, unknown>,
  submitter: { submitterName: string; submitterDepartment: string; submitterEmail: string },
): string | null {
  if (!submitter.submitterName.trim()) return "신청자 이름";
  if (!submitter.submitterDepartment.trim()) return "소속";
  if (!submitter.submitterEmail.trim()) return "이메일";

  for (const section of schema.sections) {
    if (section.optional) continue;
    for (const f of section.fields) {
      if (f.type === "checkbox") continue;
      if (isFieldEmpty(f, values[f.key])) return f.label || f.key;
    }
  }
  return null;
}

export function isFieldEmpty(field: FieldDef, v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) {
    if (v.length === 0) return true;
    if (field.type === "service_blocks") {
      const first = v[0] as Record<string, unknown> | undefined;
      const name = first?.service_name;
      return !(typeof name === "string" && name.trim());
    }
    if (field.type === "service_list") {
      return !v.some((x) => typeof x === "string" && x.trim());
    }
    return false;
  }
  if (typeof v === "object") {
    if (field.type === "date_range") {
      const r = v as { start?: string; end?: string };
      return !r.start?.trim() || !r.end?.trim();
    }
    if (field.type === "currency") {
      const c = v as { kind?: string; custom?: string };
      if (!c.kind) return true;
      if (c.kind === "기타" && !c.custom?.trim()) return true;
      return false;
    }
  }
  return false;
}
