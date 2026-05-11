/**
 * 백엔드 API 클라이언트.
 *
 * Next.js rewrites 가 /api/* → http://localhost:8000/* 로 프록시하므로
 * 클라이언트에서 호출 시 항상 `/api` prefix 를 사용한다.
 *
 * 인증:
 *   - 운영: data-platform-api 의 `platform_token` httpOnly cookie 사용
 *     (credentials: 'include' 로 자동 전송)
 *   - 로컬 mock: localStorage 의 X-User-Email 헤더 (개발 편의)
 *   - 401 응답 시 자동으로 /auth/expired 로 리다이렉트
 */

const BASE = "/api";

/** plat-api OAuth 시작 URL — 환경변수로 base 주입, fallback 은 same-origin /api */
export const PLATFORM_AUTH_LOGIN_URL = (() => {
  const base =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_PLATFORM_API_BASE) || "";
  return base
    ? `${base.replace(/\/$/, "")}/api/v1/auth/login`
    : `/api/v1/auth/login`;
})();

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
  // mock 모드 — localStorage email
  const email = getUserEmail();
  if (email) headers.set("X-User-Email", email);

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    // plat-api platform_token 쿠키 자동 전송 (cross-origin 인 경우)
    credentials: "include",
    cache: "no-store",
  });

  // 세션 만료 / 미인증 — 전역 처리
  if (res.status === 401 && typeof window !== "undefined") {
    if (!window.location.pathname.startsWith("/auth/") && window.location.pathname !== "/signin") {
      window.location.href = "/auth/expired";
    }
  }

  if (!res.ok) {
    // body 를 한 번만 읽고 JSON parse 시도 — 실패 시 텍스트 그대로 사용.
    // (이전엔 res.json() → res.text() 2단 시도하다 'body stream already read' 발생)
    const raw = await res.text();
    let detail: unknown = raw;
    try {
      detail = JSON.parse(raw);
    } catch {
      /* 텍스트 응답 그대로 유지 */
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

export type BoardType = "policy" | "process";

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
    can_write_process: boolean;
  };
}

export type Severity = "low" | "medium" | "high" | "critical";

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
  doc_type: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  author_name: string;
  is_draft: boolean;
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
  submitter_name: string;
  submitted_at: string;
  status: string;
  version: number;
  parent_form_id: number | null;
}

export type FormStatus = "draft" | "submitted" | "reviewing" | "approved" | "rejected";

export interface ApprovalEntry {
  status: FormStatus;
  changed_by: string;
  changed_at: string;
  comment: string | null;
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface EditHistoryEntry {
  edited_by: string;
  edited_at: string;
  changes: FieldChange[];
}

export type AuditSeverity = "info" | "success" | "warning" | "danger";

export interface AuditEvent {
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  severity: AuditSeverity;
}

export interface FormCommentItem {
  id: number;
  form_id: number;
  author_id: number;
  author_name: string;
  author_role: "admin" | "editor" | "viewer";
  body: string;
  created_at: string;
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
  version: number;
  parent_form_id: number | null;
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
      doc_type?: string | null;
      category?: string;
      content: string;
      is_draft?: boolean;
    } & Partial<PolicyMeta>,
  ) =>
    request<PostDetail>(`/boards/${board}/posts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** 게시글 수정 — 작성자 본인 또는 admin (백엔드에서 검증). */
  updatePost: (
    board: BoardType,
    postId: number,
    body: Partial<{
      title: string;
      doc_no: string | null;
      doc_type: string | null;
      category: string | null;
      content: string;
      is_draft: boolean;
    }> &
      Partial<PolicyMeta>,
  ) =>
    request<PostDetail>(`/boards/${board}/posts/${postId}`, {
      method: "PATCH",
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

  /** Audit Trail — 거버넌스 활동 로그.
   *  - 기본(admin 전용): 전체 이벤트
   *  - mine=true: 본인 신청서/본인 행위 이벤트만 (모든 사용자 가능). */
  listAuditEvents: (
    params: { days?: number; search?: string; severity?: string; mine?: boolean } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.days !== undefined) q.set("days", String(params.days));
    if (params.search) q.set("search", params.search);
    if (params.severity) q.set("severity", params.severity);
    if (params.mine) q.set("mine", "true");
    const qs = q.toString();
    return request<AuditEvent[]>(`/audit${qs ? `?${qs}` : ""}`);
  },

  /** 신청서 단일 댓글 스레드 — 신청자 + admin 만 접근. */
  listFormComments: (formId: number) =>
    request<FormCommentItem[]>(`/forms/${formId}/comments`),
  createFormComment: (formId: number, body: string) =>
    request<FormCommentItem>(`/forms/${formId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  deleteFormComment: (formId: number, commentId: number) =>
    request<void>(`/forms/${formId}/comments/${commentId}`, { method: "DELETE" }),

  /** 로그아웃 — plat-api 의 refresh_token 폐기 + 쿠키 삭제. mock 모드면 X-User-Email 만 비움. */
  logout: async () => {
    setUserEmail(null);
    // plat-api logout endpoint 가 동일 origin (rewrites 경유) 이라 같은 BASE 로 호출.
    // 로컬 mock backend 에는 이 endpoint 가 없으니 실패해도 무시.
    try {
      await fetch(`${BASE}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* mock backend 에는 endpoint 없음 — 무시 */
    }
  },

  /** 이미지 업로드 — 마크다운 본문 삽입용. 글 저장 전에도 호출 가능. */
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ url: string; filename: string; size_bytes: number }>(
      `/uploads/images`,
      { method: "POST", body: fd },
    );
  },
};
