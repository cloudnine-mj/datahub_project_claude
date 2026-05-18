// 추적 모드 미리보기 — FORM_SCHEMAS 기반 결재 본문 데이터 생성.
//   G Portal 전자결재 품의서 본문 입력란(HTML rich editor)에 그대로 붙여 넣을 수 있도록
//   HTML 표 + 평문 fallback 두 가지를 함께 제공.

import {
  APPLICATION_TO_FORM_TYPE,
  type ApplicationType,
} from "./applicationFormConfig";
import { FORM_SCHEMAS } from "./formSchemas";
import { valueToText } from "./formPreview";

export interface ApprovalRow {
  label: string;
  value: string;
}

export interface ApprovalData {
  /** '데이터 구독 신청서' 같은 문서 제목. */
  title: string;
  rows: ApprovalRow[];
}

/** 결재 본문에 노출할 행 데이터 — 신청자 + schema.sections 의 텍스트화 가능한 필드. */
export function buildApprovalData(
  type: ApplicationType,
  payload: Record<string, unknown>,
  applicantName: string,
  applicantDepartment: string,
): ApprovalData {
  const formType = APPLICATION_TO_FORM_TYPE[type];
  const schema = FORM_SCHEMAS[formType];

  const applicant = applicantDepartment
    ? `${applicantName} (${applicantDepartment})`
    : applicantName;

  const rows: ApprovalRow[] = [{ label: "신청자", value: applicant }];

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
      rows.push({ label: f.label, value: v });
    }
  }

  return {
    title: `${schema.label}서`,
    rows,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** G Portal 결재 본문 입력란(HTML rich editor)에 붙여 넣을 표 형태 HTML.
 *  - 외부 에디터 호환성을 위해 모든 스타일을 inline 으로, 색상은 hex 로 작성 (CSS 변수 X).
 *  - 제목은 colspan 2 헤더로 표 내부에 포함, 안내문(※) 은 표 밖 <p> 로 분리.
 */
export function generateApprovalHtml(data: ApprovalData): string {
  const rowsHtml = data.rows
    .map(
      (r) => `<tr>
<td style="border:1px solid #888; padding:8px 12px; background:#F5F5F5; font-weight:500; width:180px;">${escapeHtml(r.label)}</td>
<td style="border:1px solid #888; padding:8px 12px;">${escapeHtml(r.value)}</td>
</tr>`,
    )
    .join("\n");

  return `<table style="width:100%; border-collapse:collapse; font-size:13px; color:#222;">
<thead>
<tr>
<th colspan="2" style="border:1px solid #888; padding:10px 12px; background:#F5F5F5; font-weight:700; text-align:center; font-size:14px;">${escapeHtml(data.title)}</th>
</tr>
</thead>
<tbody>
${rowsHtml}
</tbody>
</table>`;
}

/** 평문 fallback — rich text 미지원 환경(메모장 등)에 붙여 넣을 때 사용. */
export function generateApprovalText(data: ApprovalData): string {
  const lines: string[] = [];
  lines.push(`[${data.title}]`);
  lines.push("");
  data.rows.forEach((r) => {
    lines.push(`${r.label}: ${r.value}`);
  });
  return lines.join("\n");
}
