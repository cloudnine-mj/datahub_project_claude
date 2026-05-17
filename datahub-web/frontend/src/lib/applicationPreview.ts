// 추적 모드 미리보기 — FORM_SCHEMAS 기반 평문 텍스트 생성.
//   g portal 전자결재 본문에 그대로 붙여 넣을 수 있는 포맷.

import {
  APPLICATION_TO_FORM_TYPE,
  type ApplicationType,
} from "./applicationFormConfig";
import { FORM_SCHEMAS } from "./formSchemas";
import { valueToText } from "./formPreview";

/** g portal 전자결재 본문 평문 텍스트.
 *  - 제목: '[{schema.label}서]' (예: '데이터 구독 신청서')
 *  - 본문: 신청자 + schema.sections 의 텍스트화 가능한 필드를 1, 2, 3 번호 매김
 *  - checkbox / approver_list / service_blocks / service_list 등 본문에 부적합한 type 제외
 *  - 빈 값은 라인 자체를 건너뜀
 */
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
