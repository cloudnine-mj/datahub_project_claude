/**
 * Governance form 도메인 타입 — frontend·backend 공용.
 * datahub-web 의 lib/api.ts FormType/FormStatus/ApprovalEntry 와 동일 의미.
 */

export type FormType =
  | "data_production"
  | "data_purchase"
  | "data_subscription"
  | "product_log_usage"
  | "data_production_plan"
  | "api_usage_plan"
  | "productivity_tool";

export type FormStatus = "draft" | "submitted" | "reviewing" | "approved" | "rejected";

export interface ApprovalEntry {
  status: FormStatus;
  /** 백엔드는 camelCase, 옛 SQLite 환경은 snake_case — 둘 다 허용 */
  changedBy?: string;
  changed_by?: string;
  changedAt?: string;
  changed_at?: string;
  comment: string | null;
}

export interface FormAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
}

export interface FormListItem {
  id: string;
  requestNo: string;
  formType: FormType;
  projectName: string;
  submitterName: string;
  submittedAt: string;
  status: FormStatus;
  approvedAt?: string | null;
  version: number;
  parentFormId: string | null;
  participants: string[];
}

export interface FormDetail extends FormListItem {
  submitterEmail: string;
  submitterDepartment: string | null;
  payload: Record<string, unknown>;
  updatedAt: string;
  attachments: FormAttachment[];
  approvalHistory: ApprovalEntry[] | null;
  editHistory: { editedBy: string; editedAt: string; changes: unknown[] }[] | null;
}

export interface FormMessageAttachmentItem {
  id: string;
  filename: string;
  sizeBytes: number;
}

export interface FormMessageItem {
  id: string;
  formId: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  senderRole: "applicant" | "assignee" | "admin";
  recipientName: string;
  recipientRole: "담당자" | "신청자";
  body: string;
  createdAt: string;
  attachments: FormMessageAttachmentItem[];
}
