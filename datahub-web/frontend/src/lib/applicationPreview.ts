// 신청서(추적 모드) 미리보기 — EAS 본문 에디터에 붙여넣을 HTML 표 + plain text 생성.
//   ApplicationFormConfig 의 섹션·필드를 순회해 라벨 / 값으로 row 를 만든다.
//   formPreview.ts (FormBuilder 용) 와 동일한 표 스타일·복사 동작 패턴.

import {
  APPLICATION_FORM_CONFIG,
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from "./applicationFormConfig";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface PreviewRow {
  label: string;
  value: string;
}

/** date-range 직렬값('YYYY-MM-DD~YYYY-MM-DD') 을 보기 좋은 문자열로 변환. */
function normalizeValue(raw: string | undefined, hasUnit?: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (v.includes("~")) {
    const [start, end] = v.split("~");
    if (!start.trim() && !end.trim()) return "";
    return `${start.trim() || "(미입력)"} ~ ${end.trim() || "(미입력)"}`;
  }
  if (hasUnit) return `${v} ${hasUnit}`;
  return v;
}

function collectRows(
  type: ApplicationType,
  values: Record<string, string>,
): PreviewRow[] {
  const rows: PreviewRow[] = [];
  for (const section of APPLICATION_FORM_CONFIG[type]) {
    for (const field of section.fields) {
      if (field.type === "file") {
        // 첨부는 현재 mock — 표에서 생략. 실제 첨부 연동 시 파일명 row 추가.
        continue;
      }
      const v = normalizeValue(values[field.id], field.unit);
      if (!v) continue;
      rows.push({ label: field.label, value: v });
    }
  }
  return rows;
}

export function buildApplicationPreviewHtml(
  type: ApplicationType,
  values: Record<string, string>,
): string {
  const heading = `${APPLICATION_TYPE_LABEL[type]} 신청`;
  const dataName = (values.dataName ?? "").trim();
  const fullHeading = dataName ? `${heading} — ${dataName}` : heading;

  const rows = collectRows(type, values);
  if (rows.length === 0) {
    return (
      `<h3 style="font-weight:600;margin:0 0 8px 0;">${escapeHtml(fullHeading)}</h3>` +
      `<p style="color:#64748b;font-size:13px;margin:0;">아직 입력된 내용이 없습니다.</p>`
    );
  }

  const trs = rows
    .map(
      (r) =>
        `<tr>` +
        `<td style="border:1px solid #cbd5e1;padding:6px 10px;background:#f8fafc;width:180px;font-weight:600;">${escapeHtml(
          r.label,
        )}</td>` +
        `<td style="border:1px solid #cbd5e1;padding:6px 10px;white-space:pre-wrap;">${escapeHtml(
          r.value,
        )}</td>` +
        `</tr>`,
    )
    .join("");

  return (
    `<h3 style="font-weight:600;margin:0 0 8px 0;">${escapeHtml(fullHeading)}</h3>` +
    `<table style="border-collapse:collapse;font-size:13px;line-height:1.5;">${trs}</table>`
  );
}

export function buildApplicationPreviewPlainText(
  type: ApplicationType,
  values: Record<string, string>,
): string {
  const heading = `${APPLICATION_TYPE_LABEL[type]} 신청`;
  const dataName = (values.dataName ?? "").trim();
  const fullHeading = dataName ? `${heading} — ${dataName}` : heading;

  const rows = collectRows(type, values);
  const lines = [fullHeading, ""];
  for (const r of rows) {
    lines.push(`${r.label}\t${r.value.replace(/\n/g, " / ")}`);
  }
  return lines.join("\n");
}

/** HTML + plain text 를 함께 클립보드에 넣음. ClipboardItem 미지원 시 텍스트만 fallback. */
export async function copyApplicationPreviewToClipboard(
  type: ApplicationType,
  values: Record<string, string>,
): Promise<void> {
  const html = buildApplicationPreviewHtml(type, values);
  const text = buildApplicationPreviewPlainText(type, values);
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
