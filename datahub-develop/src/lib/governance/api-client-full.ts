/**
 * datahub-web 의 `lib/api.ts` 와 동일한 시그니처를 가진 governance API client.
 * 옛 컴포넌트가 import 경로만 바꾸면 그대로 동작하도록 method 이름/형태 호환 유지.
 *
 * 미구현(첨부 다운로드 URL, 일부 admin 액션) 은 placeholder 반환.
 */

import type {
  FormDetail,
  FormListItem,
  FormMessageItem,
  FormType,
  FormStatus,
} from "./forms/types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    let detail: unknown = text;
    try {
      detail = JSON.parse(text);
    } catch {
      /* keep */
    }
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    const err = new Error(`API ${res.status}: ${msg}`);
    (err as Error & { status?: number; detail?: unknown }).status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── 도메인 타입 (옛 api 의 shape 와 호환) ────────────────────

export type { FormType, FormStatus, FormListItem, FormDetail, FormMessageItem };

export interface Me {
  user: {
    id: string;
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

export interface ApprovalEntry {
  status: FormStatus;
  changed_by: string;
  changed_at: string;
  comment: string | null;
}

export interface PostListItem {
  id: string;
  title: string;
  doc_no: string | null;
  doc_type: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  author_name: string;
  is_draft: boolean;
  pinned: boolean;
  visibility: "public" | "admin";
  summary?: string | null;
  tags?: string[] | null;
  severity?: string | null;
  applies_to?: string | null;
  tldr?: string | null;
  action_items?: string[] | null;
  examples?: string | null;
}

export interface PostDetail extends PostListItem {
  board_type: "policy" | "process";
  content: string;
  attachments: { id: string; filename: string; size_bytes: number }[];
}

export interface FormCommentItem {
  id: string;
  form_id: string;
  author_id: string;
  author_name: string;
  author_role: "admin" | "editor" | "viewer";
  body: string;
  created_at: string;
}

export interface FormMessageAttachment {
  id: string;
  filename: string;
  size_bytes: number;
}

export type BoardType = "policy" | "process";

/** 백엔드 camelCase → 옛 snake_case shape 로 변환. 컴포넌트 호환성 유지용. */
function adaptMessage(m: Record<string, unknown>): FormMessageItem & Record<string, unknown> {
  const attachments = ((m.attachments as { id: string; filename: string; sizeBytes: number }[]) ?? []).map(
    (a) => ({
      id: a.id,
      filename: a.filename,
      sizeBytes: a.sizeBytes,
      size_bytes: a.sizeBytes,
    }),
  );
  return {
    id: m.id as string,
    formId: m.formId as string,
    senderId: m.senderId as string,
    senderName: m.senderName as string,
    senderEmail: m.senderEmail as string,
    senderRole: m.senderRole as FormMessageItem["senderRole"],
    recipientName: m.recipientName as string,
    recipientRole: m.recipientRole as FormMessageItem["recipientRole"],
    body: m.body as string,
    createdAt: m.createdAt as string,
    attachments: attachments as unknown as FormMessageItem["attachments"],
    // snake_case
    form_id: m.formId,
    sender_id: m.senderId,
    sender_name: m.senderName,
    sender_email: m.senderEmail,
    sender_role: m.senderRole,
    recipient_name: m.recipientName,
    recipient_role: m.recipientRole,
    created_at: m.createdAt,
  };
}

function adaptComment(c: Record<string, unknown>): FormCommentItem & Record<string, unknown> {
  return {
    id: c.id as string,
    form_id: c.formId as string,
    author_id: c.authorId as string,
    author_name: c.authorName as string,
    author_role: c.authorRole as FormCommentItem["author_role"],
    body: c.body as string,
    created_at: c.createdAt as string,
    // camelCase
    formId: c.formId,
    authorId: c.authorId,
    authorName: c.authorName,
    authorRole: c.authorRole,
    createdAt: c.createdAt,
  };
}

function adaptPost(p: Record<string, unknown>): PostDetail & Record<string, unknown> {
  const attachments = ((p.attachments as { id: string; filename: string; sizeBytes: number }[]) ?? []).map(
    (a) => ({ id: a.id, filename: a.filename, size_bytes: a.sizeBytes, sizeBytes: a.sizeBytes }),
  );
  return {
    id: String(p.id),
    board_type: p.boardType as BoardType,
    title: p.title as string,
    doc_no: (p.docNo as string | null) ?? null,
    doc_type: (p.docType as string | null) ?? null,
    category: (p.category as string | null) ?? null,
    content: (p.content as string) ?? "",
    is_draft: !!p.isDraft,
    pinned: !!p.pinned,
    visibility: (p.visibility as "public" | "admin") ?? "public",
    author_name: (p.authorName as string) ?? "",
    created_at: p.createdAt as string,
    updated_at: p.updatedAt as string,
    summary: (p.summary as string | null) ?? null,
    tags: (p.tags as string[] | null) ?? null,
    severity: (p.severity as string | null) ?? null,
    applies_to: (p.appliesTo as string | null) ?? null,
    tldr: (p.tldr as string | null) ?? null,
    action_items: (p.actionItems as string[] | null) ?? null,
    examples: (p.examples as string | null) ?? null,
    attachments: attachments as unknown as PostDetail["attachments"],
    // camelCase 호환
    boardType: p.boardType,
    docNo: p.docNo,
    docType: p.docType,
    isDraft: !!p.isDraft,
    authorName: p.authorName,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    appliesTo: p.appliesTo,
    actionItems: p.actionItems,
  };
}

function adaptForm(f: Record<string, unknown>): FormDetail & Record<string, unknown> {
  const participants = Array.isArray((f.payload as Record<string, unknown> | null)?.["참조자"])
    ? ((f.payload as Record<string, unknown>)["참조자"] as string[]).filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
    : [];
  const camelHistory = (f.approvalHistory as { status: string; changedBy?: string; changedAt?: string; comment?: string | null }[] | null) ?? null;
  // snake_case 호환 — datahub-web 옛 FormDetail/ApprovalEntry shape
  const snakeHistory = camelHistory
    ? camelHistory.map((e) => ({
        status: e.status,
        changed_by: e.changedBy ?? "",
        changed_at: e.changedAt ?? "",
        comment: e.comment ?? null,
      }))
    : null;
  const attachments = ((f.attachments as { id: string; filename: string; sizeBytes: number }[]) ?? []).map(
    (a) => ({ id: a.id, filename: a.filename, sizeBytes: a.sizeBytes, size_bytes: a.sizeBytes }),
  );

  let approvedAt: string | null = null;
  if ((f.status as string) === "approved" && Array.isArray(camelHistory)) {
    for (let i = camelHistory.length - 1; i >= 0; i--) {
      const entry = camelHistory[i];
      if (entry?.status === "approved" && entry.changedAt) {
        approvedAt = entry.changedAt;
        break;
      }
    }
  }

  return {
    // camelCase
    id: f.id as string,
    requestNo: f.requestNo as string,
    formType: f.formType as FormType,
    projectName: f.projectName as string,
    submitterName: f.submitterName as string,
    submittedAt: f.submittedAt as string,
    status: f.status as FormStatus,
    version: (f.version as number) ?? 1,
    parentFormId: (f.parentFormId as string | null) ?? null,
    participants,
    submitterEmail: f.submitterEmail as string,
    submitterDepartment: (f.submitterDepartment as string | null) ?? null,
    payload: (f.payload as Record<string, unknown>) ?? {},
    updatedAt: f.updatedAt as string,
    attachments: attachments as unknown as FormDetail["attachments"],
    approvalHistory: camelHistory as unknown as FormDetail["approvalHistory"],
    editHistory: (f.editHistory as FormDetail["editHistory"]) ?? null,
    approvedAt,
    // snake_case 호환 (옛 datahub-web 컴포넌트)
    request_no: f.requestNo,
    form_type: f.formType,
    project_name: f.projectName,
    submitter_name: f.submitterName,
    submitter_email: f.submitterEmail,
    submitter_department: f.submitterDepartment,
    submitted_at: f.submittedAt,
    updated_at: f.updatedAt,
    parent_form_id: f.parentFormId,
    approval_history: snakeHistory,
    edit_history: f.editHistory,
    approved_at: approvedAt,
  };
}

// ── API ───────────────────────────────────────────────────

export const api = {
  // me / logout
  me: async (): Promise<Me> => {
    interface MeResponse {
      user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        role: "USER" | "ADMIN" | string;
        labId: string | null;
        techCellId: string | null;
        permissions: unknown[];
      } | null;
    }
    const r = (await request("/auth/me")) as MeResponse;
    if (!r.user) {
      throw new Error("not authenticated");
    }
    // datahub-develop role(USER/ADMIN) → datahub-web 컴포넌트가 기대하는 role(admin/editor/viewer) 매핑
    const role: "admin" | "editor" | "viewer" =
      r.user.role === "ADMIN" || r.user.role === "admin" ? "admin" : "editor";
    return {
      user: {
        id: r.user.id,
        email: r.user.email,
        name: r.user.name ?? r.user.email.split("@")[0],
        role,
        department: null,
      },
      // datahub-develop 은 permissions 가 array. datahub-web 컴포넌트는 boolean 객체를
      // 기대 — admin 이면 모두 true, 일반 사용자는 모두 false (게시판 작성은 admin 만).
      permissions: {
        can_write_policy: role === "admin",
        can_write_process: role === "admin",
      },
    };
  },
  logout: async () => {
    try {
      await fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
  },

  // Forms
  listForms: async (params: { form_type?: FormType; mine?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.form_type) qs.set("form_type", params.form_type);
    if (params.mine !== undefined) qs.set("mine", String(params.mine));
    const q = qs.toString();
    const rows = (await request<Record<string, unknown>[]>(
      `/governance/forms${q ? `?${q}` : ""}`,
    )) ?? [];
    // 옛 컴포넌트 호환 위해 snake_case 도 함께 노출.
    return rows.map((r) => ({
      ...r,
      request_no: r.requestNo,
      form_type: r.formType,
      project_name: r.projectName,
      submitter_name: r.submitterName,
      submitted_at: r.submittedAt,
      parent_form_id: r.parentFormId,
      approved_at: r.approvedAt,
    })) as unknown as FormListItem[];
  },
  getForm: async (id: string | number) =>
    adaptForm((await request(`/governance/forms/${id}`)) as Record<string, unknown>),
  submitForm: async (body: {
    form_type: FormType;
    project_name: string;
    payload: Record<string, unknown>;
    status?: string;
    submitter_name?: string;
    submitter_email?: string;
    submitter_department?: string;
  }) =>
    adaptForm(
      (await request("/governance/forms", {
        method: "POST",
        body: JSON.stringify(body),
      })) as Record<string, unknown>,
    ),
  updateForm: async (
    id: string | number,
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
    adaptForm(
      (await request(`/governance/forms/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })) as Record<string, unknown>,
    ),
  deleteForm: (id: string | number) =>
    request<void>(`/governance/forms/${id}`, { method: "DELETE" }),
  changeFormStatus: async (
    id: string | number,
    body: { status: FormStatus; comment?: string; action?: string },
  ) =>
    adaptForm(
      (await request(`/governance/forms/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })) as Record<string, unknown>,
    ),
  exportFormUrl: (id: string | number) => `${BASE}/governance/forms/${id}/export`,

  // Form attachments — Phase 5 (GCS) 보류, placeholder URL.
  uploadFormAttachment: (_formId: string | number, _file: File) => {
    console.warn("[governance] uploadFormAttachment Phase 5 (GCS) 미구현");
    return Promise.resolve({ id: "", filename: _file.name, size_bytes: _file.size });
  },
  formAttachmentUrl: (_formId: string | number, _attId: string | number) => "#",
  deleteFormAttachment: (_formId: string | number, _attId: string | number) =>
    Promise.resolve(),

  // Form messages (양방향 채팅)
  listFormMessages: async (formId: string | number) => {
    const list = (await request<Record<string, unknown>[]>(
      `/governance/forms/${formId}/messages`,
    )) ?? [];
    return list.map(adaptMessage) as unknown as FormMessageItem[];
  },
  createFormMessage: async (formId: string | number, body: string) => {
    const r = (await request<Record<string, unknown>>(
      `/governance/forms/${formId}/messages`,
      { method: "POST", body: JSON.stringify({ body }) },
    )) as Record<string, unknown>;
    return adaptMessage(r) as unknown as FormMessageItem;
  },
  uploadFormMessageAttachment: (_formId: string | number, _mid: string | number, _file: File) => {
    console.warn("[governance] uploadFormMessageAttachment Phase 5 미구현");
    return Promise.resolve({ id: "", filename: _file.name, size_bytes: _file.size });
  },
  formMessageAttachmentUrl: (_formId: string | number, _mid: string | number, _aid: string | number) => "#",

  // Form comments
  listFormComments: async (formId: string | number) => {
    const rows = (await request<Record<string, unknown>[]>(
      `/governance/forms/${formId}/comments`,
    )) ?? [];
    return rows.map(adaptComment) as unknown as FormCommentItem[];
  },
  createFormComment: async (formId: string | number, body: string) => {
    const r = (await request<Record<string, unknown>>(
      `/governance/forms/${formId}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
    )) as Record<string, unknown>;
    return adaptComment(r) as unknown as FormCommentItem;
  },
  deleteFormComment: (formId: string | number, commentId: string | number) =>
    request<void>(`/governance/forms/${formId}/comments/${commentId}`, { method: "DELETE" }),

  // Posts (정책 / 프로세스 게시판)
  listPosts: async (board: BoardType): Promise<PostListItem[]> => {
    const rows = (await request<Record<string, unknown>[]>(
      `/governance/posts?board=${board}`,
    )) ?? [];
    return rows.map(adaptPost) as unknown as PostListItem[];
  },
  listMyPosts: async (board: BoardType): Promise<PostListItem[]> => {
    const rows = (await request<Record<string, unknown>[]>(
      `/governance/posts?board=${board}&mine=true`,
    )) ?? [];
    return rows.map(adaptPost) as unknown as PostListItem[];
  },
  getPost: async (_board: BoardType, id: string | number) =>
    adaptPost((await request(`/governance/posts/${id}`)) as Record<string, unknown>),
  createPost: async (
    board: BoardType,
    body: Record<string, unknown>,
  ) =>
    adaptPost(
      (await request(`/governance/posts`, {
        method: "POST",
        body: JSON.stringify({ ...body, board_type: board }),
      })) as Record<string, unknown>,
    ),
  updatePost: async (
    _board: BoardType,
    postId: string | number,
    body: Record<string, unknown>,
  ) =>
    adaptPost(
      (await request(`/governance/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })) as Record<string, unknown>,
    ),
  uploadPostAttachment: (_board: BoardType, _postId: string | number, _file: File) => {
    console.warn("[governance] uploadPostAttachment Phase 5 미구현");
    return Promise.resolve({ id: "", filename: _file.name, size_bytes: _file.size });
  },
  postAttachmentUrl: (_board: BoardType, _postId: string | number, _attId: string | number) => "#",
  deletePost: (_board: BoardType, postId: string | number) =>
    request<void>(`/governance/posts/${postId}`, { method: "DELETE" }),
  togglePinPost: async (_board: BoardType, postId: string | number) =>
    adaptPost(
      (await request(`/governance/posts/${postId}/pin`, { method: "PATCH" })) as Record<
        string,
        unknown
      >,
    ),

  // Image upload (markdown 본문 삽입용) — placeholder
  uploadImage: (_file: File) => {
    console.warn("[governance] uploadImage 미구현");
    return Promise.resolve({ url: "", filename: _file.name, size_bytes: _file.size });
  },
};
