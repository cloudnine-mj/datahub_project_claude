// 추적 모드 미리보기 — FORM_SCHEMAS 의 실제 양식 구조 기반.
//   draft 모드는 FormBuilder 가 자체 미리보기를 제공하므로, 이 헬퍼는 추적 모드(읽기 전용) 전용.
//   formPreview.ts 의 escape / valueToText 재사용해 HTML 표 + plain text 생성.

import {
  APPLICATION_TO_FORM_TYPE,
  APPLICATION_TYPE_LABEL,
  MOCK_SUBMITTED_PAYLOAD,
  type ApplicationType,
} from "./applicationFormConfig";
import { FORM_SCHEMAS } from "./formSchemas";
import { valueToText } from "./formPreview";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function collectRows(type: ApplicationType): { label: string; value: string }[] {
  const formType = APPLICATION_TO_FORM_TYPE[type];
  const schema = FORM_SCHEMAS[formType];
  const payload = MOCK_SUBMITTED_PAYLOAD[type];
  const rows: { label: string; value: string }[] = [];
  for (const section of schema.sections) {
    for (const f of section.fields) {
      const raw = payload[f.key];
      const text = valueToText(f, raw);
      if (!text) continue;
      rows.push({ label: f.label, value: text });
    }
  }
  return rows;
}

export function buildApplicationPreviewHtml(type: ApplicationType): string {
  const heading = `${APPLICATION_TYPE_LABEL[type]} 신청`;
  const projectName =
    type === "service"
      ? (MOCK_SUBMITTED_PAYLOAD.service.데이터셋_이름 as string | undefined)
      : (MOCK_SUBMITTED_PAYLOAD[type].프로젝트명 as string | undefined);
  const fullHeading = projectName ? `${heading} — ${projectName}` : heading;

  const rows = collectRows(type);
  if (rows.length === 0) {
    return (
      `<h3 style="font-weight:600;margin:0 0 8px 0;">${escapeHtml(fullHeading)}</h3>` +
      `<p style="color:#64748b;font-size:13px;margin:0;">아직 입력된 내용이 없습니다.</p>`
    );
  }

  // 신청자 row 를 표 가장 위에 고정.
  const allRows = [
    { label: "신청자", value: "김데이터 (AI Platform)" },
    ...rows,
  ];

  const trs = allRows
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

export function buildApplicationPreviewPlainText(type: ApplicationType): string {
  const heading = `${APPLICATION_TYPE_LABEL[type]} 신청`;
  const projectName =
    type === "service"
      ? (MOCK_SUBMITTED_PAYLOAD.service.데이터셋_이름 as string | undefined)
      : (MOCK_SUBMITTED_PAYLOAD[type].프로젝트명 as string | undefined);
  const fullHeading = projectName ? `${heading} — ${projectName}` : heading;

  const rows = collectRows(type);
  const lines = [
    fullHeading,
    "",
    `신청자\t김데이터 (AI Platform)`,
  ];
  for (const r of rows) {
    lines.push(`${r.label}\t${r.value.replace(/\n/g, " / ")}`);
  }
  return lines.join("\n");
}

export async function copyApplicationPreviewToClipboard(
  type: ApplicationType,
): Promise<void> {
  const html = buildApplicationPreviewHtml(type);
  const text = buildApplicationPreviewPlainText(type);
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

/** g portal 전자결재 본문에 그대로 붙여 넣을 평문 텍스트 생성.
 *  - 제목: '[{schema.label}서]'  (예: '데이터 구독 신청서')
 *  - 본문: 신청자 + schema.sections 의 모든 필드를 1, 2, 3 번호 매겨서 라인 단위로
 *  - checkbox / approver_list / service_blocks 등 본문 텍스트에 부적합한 type 은 제외
 *  - 빈 값은 라인 자체를 건너뜀 */
export function generateApprovalText(
  type: ApplicationType,
  payload: Record<string, unknown>,
  applicantName: string,
  applicantDepartment: string,
): string {
  const formType = APPLICATION_TO_FORM_TYPE[type];
  const schema = FORM_SCHEMAS[formType];

  const lines: string[] = [];
  lines.push(`[${schema.label}서]`);
  lines.push("");

  let idx = 1;
  const applicant = applicantDepartment
    ? `${applicantName} (${applicantDepartment})`
    : applicantName;
  lines.push(`${idx++}. 신청자: ${applicant}`);

  for (const section of schema.sections) {
    for (const f of section.fields) {
      if (
        f.type === "checkbox" ||
        f.type === "approver_list" ||
        f.type === "service_blocks" ||
        f.type === "service_list"
      ) {
        continue;
      }
      const v = valueToText(f, payload[f.key]);
      if (!v.trim()) continue;
      lines.push(`${idx++}. ${f.label}: ${v}`);
    }
  }

  lines.push("");
  lines.push("※ 본 신청은 Datahub에서 검토를 완료한 사항입니다.");
  return lines.join("\n");
}
