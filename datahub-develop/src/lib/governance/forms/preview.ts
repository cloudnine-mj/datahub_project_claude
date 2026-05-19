// 신청서 미리보기 — 전자결재(EAS) 본문 에디터에 붙여넣을 HTML 표 / plain text 를 생성.
//
// detail 페이지(저장된 신청서)와 FormBuilder 작성 중(in-progress 값) 양쪽에서 사용하므로
// 도메인 객체에 직접 의존하지 않고 정규화된 PreviewData 만 받음.

import type { FieldDef } from "./schemas";

export type PreviewData = {
  typeLabel: string;
  projectName: string;
  submitterName: string;
  submitterDepartment: string;
  submitterEmail: string;
  payload: Record<string, unknown>;
  fields: FieldDef[];
};

/** payload 의 단일 값을 plain text 한 줄로 직렬화 — 복사용 fallback / HTML cell 내용에도 사용. */
export function valueToText(field: FieldDef, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (field.type === "approver_list" && Array.isArray(v)) {
    return (v as unknown[])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .join(", ");
  }
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return Object.entries(item as Record<string, unknown>)
            .map(([k, val]) => `${k}: ${val ?? ""}`)
            .join(", ");
        }
        return String(item);
      })
      .join("\n");
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("value" in obj || "checked" in obj) {
      const checked = obj.checked ? "✓ " : "";
      const value = obj.value ?? obj.checked ?? "";
      return `${checked}${value}`;
    }
    return JSON.stringify(obj);
  }
  return String(v);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPreviewHtml(d: PreviewData): string {
  const rows: { label: string; value: string }[] = [
    { label: "신청 종류", value: d.typeLabel },
    { label: "신청자 이름", value: d.submitterName },
    { label: "소속", value: d.submitterDepartment || "-" },
    { label: "이메일", value: d.submitterEmail },
  ];
  for (const f of d.fields) {
    const v = d.payload[f.key];
    if (v === undefined || v === null || v === "") continue;
    rows.push({ label: f.label, value: valueToText(f, v) });
  }
  const trs = rows
    .map(
      (r) =>
        `<tr>` +
        `<td style="border:1px solid #cbd5e1;padding:6px 10px;background:#f8fafc;width:180px;font-weight:600;">${escapeHtml(r.label)}</td>` +
        `<td style="border:1px solid #cbd5e1;padding:6px 10px;white-space:pre-wrap;">${escapeHtml(r.value)}</td>` +
        `</tr>`,
    )
    .join("");
  const heading = d.projectName
    ? `${escapeHtml(d.typeLabel)} — ${escapeHtml(d.projectName)}`
    : escapeHtml(d.typeLabel);
  return (
    `<h3 style="font-weight:700;margin:0 0 8px 0;">${heading}</h3>` +
    `<table style="border-collapse:collapse;font-size:13px;line-height:1.5;">${trs}</table>`
  );
}

export function buildPreviewPlainText(d: PreviewData): string {
  const heading = d.projectName ? `${d.typeLabel} — ${d.projectName}` : d.typeLabel;
  const rows: string[] = [
    heading,
    "",
    `신청자 이름\t${d.submitterName}`,
    `소속\t${d.submitterDepartment || "-"}`,
    `이메일\t${d.submitterEmail}`,
  ];
  for (const f of d.fields) {
    const v = d.payload[f.key];
    if (v === undefined || v === null || v === "") continue;
    rows.push(`${f.label}\t${valueToText(f, v).replace(/\n/g, " / ")}`);
  }
  return rows.join("\n");
}

/** 미리보기 헤더용 프로젝트명 — schema.projectField 가 service_blocks 같은 배열이면
 *  첫 항목의 service_name 을 꺼냄. 비어있으면 빈 문자열. */
export function derivePreviewProjectName(raw: unknown): string {
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object" && raw[0]) {
    const name = (raw[0] as Record<string, unknown>).service_name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return "";
  }
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";
  return String(raw);
}

/** 클립보드 복사 헬퍼 — HTML + plain text 둘 다 넣고, ClipboardItem 미지원 환경은 text fallback. */
export async function copyPreviewToClipboard(data: PreviewData): Promise<void> {
  const html = buildPreviewHtml(data);
  const text = buildPreviewPlainText(data);
  if (typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(text);
}
