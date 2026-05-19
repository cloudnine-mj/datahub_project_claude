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

type BoardType = "policy" | "process";

/** 백엔드 camelCase → 옛 snake_case shape 로 변환. 컴포넌트 호환성 유지용. */
function adaptPost(p: Record<string, unknown>): PostDetail {
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
    attachments: ((p.attachments as { id: string; filename: string; sizeBytes: number }[]) ?? []).map(
      (a) => ({ id: a.id, filename: a.filename, size_bytes: a.sizeBytes }),
    ),
  };
}

function adaptForm(f: Record<string, unknown>): FormDetail {
  const participants = Array.isArray((f.payload as Record<string, unknown> | null)?.["참조자"])
    ? ((f.payload as Record<string, unknown>)["참조자"] as string[]).filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0,
      )
    : [];
  return {
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
    attachments: ((f.attachments as { id: string; filename: string; sizeBytes: number }[]) ?? []).map(
      (a) => ({ id: a.id, filename: a.filename, sizeBytes: a.sizeBytes }),
    ),
    approvalHistory: (f.approvalHistory as FormDetail["approvalHistory"]) ?? null,
    editHistory: (f.editHistory as FormDetail["editHistory"]) ?? null,
  };
}

// ── API ───────────────────────────────────────────────────

export const api = {
  // me / logout
  me: () => request<Me>("/auth/me").then((m) => m),
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
    return request<FormListItem[]>(`/governance/forms${q ? `?${q}` : ""}`);
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
    body: { status: FormStatus; comment?: string },
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
    const list = (await request<FormMessageItem[]>(
      `/governance/forms/${formId}/messages`,
    )) ?? [];
    return list;
  },
  createFormMessage: (formId: string | number, body: string) =>
    request<FormMessageItem>(`/governance/forms/${formId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  uploadFormMessageAttachment: (_formId: string | number, _mid: string | number, _file: File) => {
    console.warn("[governance] uploadFormMessageAttachment Phase 5 미구현");
    return Promise.resolve({ id: "", filename: _file.name, size_bytes: _file.size });
  },
  formMessageAttachmentUrl: (_formId: string | number, _mid: string | number, _aid: string | number) => "#",

  // Form comments
  listFormComments: (formId: string | number) =>
    request<FormCommentItem[]>(`/governance/forms/${formId}/comments`),
  createFormComment: (formId: string | number, body: string) =>
    request<FormCommentItem>(`/governance/forms/${formId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  deleteFormComment: (formId: string | number, commentId: string | number) =>
    request<void>(`/governance/forms/${formId}/comments/${commentId}`, { method: "DELETE" }),

  // Posts (정책 / 프로세스 게시판)
  listPosts: async (board: BoardType): Promise<PostListItem[]> => {
    const rows = (await request<Record<string, unknown>[]>(
      `/governance/posts?board=${board}`,
    )) ?? [];
    return rows.map(adaptPost);
  },
  listMyPosts: async (board: BoardType): Promise<PostListItem[]> => {
    const rows = (await request<Record<string, unknown>[]>(
      `/governance/posts?board=${board}&mine=true`,
    )) ?? [];
    return rows.map(adaptPost);
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
