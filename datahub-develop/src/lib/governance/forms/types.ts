/**
 * Governance form 도메인 타입 — frontend·backend 공용.
 * datahub-web 의 lib/api.ts FormType/FormStatus/ApprovalEntry 와 동일 의미.
 *
 * 모든 List/Detail 타입은 camelCase 가 canonical 이고, snake_case 별칭을 함께
 * 가집니다. api-client-full 의 adapter 가 두 표기를 모두 채워 주므로 옛 컴포넌트와
 * 신규 컴포넌트가 같이 살아 있을 수 있습니다.
 */

export type FormType =
  | "data_production"
  | "data_purchase"
  | "data_subscription"
  | "product_log_usage"
  | "data_production_plan"
  | "api_usage_plan"
  | "productivity_tool";

export type FormStatus = "draft" | "submitted" | "reviewing" | "info_requested" | "approved" | "rejected";

export interface ApprovalEntry {
  status: FormStatus;
  /** 백엔드는 camelCase, 옛 SQLite 환경은 snake_case — 둘 다 허용 */
  changedBy?: string;
  changed_by?: string;
  changedAt?: string;
  changed_at?: string;
  comment: string | null;
  /** 명시적 액션 타입 — 신규 추가. 없는 옛 엔트리는 status/comment 로 휴리스틱 매핑. */
  action?:
    | "submitted"
    | "review_started"
    | "info_requested"
    | "info_resubmitted"
    | "review_resumed"
    | "approved"
    | "draft";
}

export interface FormAttachment {
  id: string;
  filename: string;
  sizeBytes: number;
  /** snake_case 호환 — adapter 가 함께 채워줌. */
  size_bytes: number;
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
  /** snake_case 호환 — adapter 가 함께 채워줌. */
  request_no: string;
  form_type: FormType;
  project_name: string;
  submitter_name: string;
  submitted_at: string;
  approved_at?: string | null;
  parent_form_id: string | null;
}

export interface FormDetail extends FormListItem {
  submitterEmail: string;
  submitterDepartment: string | null;
  payload: Record<string, unknown>;
  updatedAt: string;
  attachments: FormAttachment[];
  approvalHistory: ApprovalEntry[] | null;
  editHistory: { editedBy: string; editedAt: string; changes: unknown[] }[] | null;
  /** snake_case 호환 — adapter 가 함께 채워줌. */
  submitter_email: string;
  submitter_department: string | null;
  updated_at: string;
  approval_history: ApprovalEntry[] | null;
  edit_history: { editedBy: string; editedAt: string; changes: unknown[] }[] | null;
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
