/**
 * 백엔드 API 클라이언트.
 *
 * Next.js rewrites 가 /api/* → http://localhost:8000/* 로 프록시하므로
 * 클라이언트에서 호출 시 항상 `/api` prefix 를 사용한다.
 *
 * 임시 인증: localStorage 의 X-User-Email 을 헤더로 자동 첨부.
 * 미설정 시 백엔드가 default_admin_email (Karlo Lee) 로 fallback.
 */

const BASE = "/api";

function getUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("datahub-user-email");
}

export function setUserEmail(email: string | null): void {
  if (typeof window === "undefined") return;
  if (email) window.localStorage.setItem("datahub-user-email", email);
  else window.localStorage.removeItem("datahub-user-email");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const email = getUserEmail();
  if (email) headers.set("X-User-Email", email);

  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    const err = new Error(`API ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
    (err as Error & { status?: number; detail?: unknown }).status = res.status;
    (err as Error & { status?: number; detail?: unknown }).detail = detail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── 도메인 타입 ─────────────────────────────────────────

export type BoardType = "policy" | "production_process" | "usage_process";

export interface Me {
  user: {
    id: number;
    email: string;
    name: string;
    role: "admin" | "editor" | "viewer";
    department: string | null;
  };
  permissions: {
    can_write_policy: boolean;
    can_write_production_process: boolean;
    can_write_usage_process: boolean;
  };
}

export type Severity = "required" | "recommended";

/** 정책 게시판에서만 활용되는 메타필드 — Step 2,3,4 의 Opportunity 매핑. */
export interface PolicyMeta {
  summary?: string | null;
  tags?: string[] | null;
  severity?: Severity | null;
  applies_to?: string | null;
  tldr?: string | null;
  action_items?: string[] | null;
  examples?: string | null;
}

export interface PostListItem extends PolicyMeta {
  id: number;
  title: string;
  doc_no: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  author_name: string;
}

export interface PostDetail extends PostListItem {
  board_type: BoardType;
  category: string | null;
  content: string;
  attachments: { id: number; filename: string; size_bytes: number }[];
}

export type FormType =
  | "data_production"
  | "data_purchase"
  | "data_subscription"
  | "product_log_usage"
  | "data_production_plan"
  | "api_usage_plan"
  | "productivity_tool";

export interface FormListItem {
  id: number;
  request_no: string;
  form_type: FormType;
  project_name: string;
  submitted_at: string;
  status: string;
}

export type FormStatus = "draft" | "submitted" | "reviewing" | "approved" | "rejected";

export interface ApprovalEntry {
  status: FormStatus;
  changed_by: string;
  changed_at: string;
  comment: string | null;
}

export interface EditHistoryEntry {
  edited_by: string;
  edited_at: string;
}

export interface FormDetail extends FormListItem {
  submitter_name: string;
  submitter_email: string;
  submitter_department: string | null;
  payload: Record<string, unknown>;
  updated_at: string;
  attachments: { id: number; filename: string; size_bytes: number }[];
  approval_history: ApprovalEntry[] | null;
  edit_history: EditHistoryEntry[] | null;
}

// ── API 함수 ────────────────────────────────────────────

export const api = {
  me: () => request<Me>("/me"),

  listPosts: (board: BoardType) => request<PostListItem[]>(`/boards/${board}/posts`),
  getPost: (board: BoardType, id: number) => request<PostDetail>(`/boards/${board}/posts/${id}`),
  createPost: (
    board: BoardType,
    body: {
      title: string;
      doc_no?: string | null;
      category?: string;
      content: string;
    } & Partial<PolicyMeta>,
  ) =>
    request<PostDetail>(`/boards/${board}/posts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** 게시글에 파일 1개 업로드 (multipart/form-data). */
  uploadPostAttachment: (board: BoardType, postId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ id: number; filename: string; size_bytes: number }>(
      `/boards/${board}/posts/${postId}/attachments`,
      { method: "POST", body: fd },
    );
  },
  postAttachmentUrl: (board: BoardType, postId: number, attId: number) =>
    `${BASE}/boards/${board}/posts/${postId}/attachments/${attId}`,

  /** 게시글 삭제 — 작성자 본인 또는 admin 만 가능 (백엔드에서 검증). */
  deletePost: (board: BoardType, postId: number) =>
    request<void>(`/boards/${board}/posts/${postId}`, { method: "DELETE" }),

  listForms: (params: { form_type?: FormType; mine?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.form_type) q.set("form_type", params.form_type);
    if (params.mine !== undefined) q.set("mine", String(params.mine));
    const qs = q.toString();
    return request<FormListItem[]>(`/forms${qs ? `?${qs}` : ""}`);
  },
  getForm: (id: number) => request<FormDetail>(`/forms/${id}`),
  submitForm: (body: {
    form_type: FormType;
    project_name: string;
    payload: Record<string, unknown>;
    status?: string;
    submitter_name?: string;
    submitter_email?: string;
    submitter_department?: string;
  }) =>
    request<FormDetail>("/forms", { method: "POST", body: JSON.stringify(body) }),

  /** 신청서 수정 — 작성자 본인 또는 admin. 매 호출마다 edit_history 에 한 줄 누적. */
  updateForm: (
    id: number,
    body: {
      form_type: FormType;
      project_name: string;
      payload: Record<string, unknown>;
      status?: string;
      submitter_name?: string;
      submitter_email?: string;
      submitter_department?: string;
    },
  ) =>
    request<FormDetail>(`/forms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  exportFormUrl: (id: number) => `${BASE}/forms/${id}/export`,

  /** 신청서 삭제 — 제출자 본인 또는 admin 만 가능 (백엔드에서 검증). */
  deleteForm: (id: number) =>
    request<void>(`/forms/${id}`, { method: "DELETE" }),

  /** 신청서 상태 변경 — admin 만. 변경 이력은 approval_history 에 누적. */
  changeFormStatus: (id: number, body: { status: FormStatus; comment?: string }) =>
    request<FormDetail>(`/forms/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  /** 신청서 1개에 파일 1개 업로드 (multipart/form-data). */
  uploadFormAttachment: (formId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ id: number; filename: string; size_bytes: number }>(
      `/forms/${formId}/attachments`,
      { method: "POST", body: fd },
    );
  },
  formAttachmentUrl: (formId: number, attId: number) => `${BASE}/forms/${formId}/attachments/${attId}`,
  deleteFormAttachment: (formId: number, attId: number) =>
    request<void>(`/forms/${formId}/attachments/${attId}`, { method: "DELETE" }),
};
