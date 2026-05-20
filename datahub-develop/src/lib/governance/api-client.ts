/**
 * Governance BFF API client — 브라우저 컴포넌트가 datahub-develop BFF route 를 호출.
 *
 * datahub-web 의 `lib/api.ts` 를 대체. 인증은 platform_token 쿠키가 자동 전송되며
 * 클라이언트에서 별도 헤더 처리 불필요.
 */

import type {
  FormDetail,
  FormListItem,
  FormMessageItem,
  FormType,
} from "./forms/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
      /* keep text */
    }
    const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
    const err = new Error(`API ${res.status}: ${msg}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface FormCreateBody {
  form_type: FormType;
  project_name: string;
  payload: Record<string, unknown>;
  status?: "draft" | "submitted";
  submitter_name?: string;
  submitter_email?: string;
  submitter_department?: string;
}

export interface FormUpdateBody extends FormCreateBody {}

export const governanceApi = {
  // Forms
  listForms: (params: { mine?: boolean; formType?: FormType } = {}) => {
    const qs = new URLSearchParams();
    if (params.mine !== undefined) qs.set("mine", String(params.mine));
    if (params.formType) qs.set("form_type", params.formType);
    const q = qs.toString();
    return request<FormListItem[]>(`/api/governance/forms${q ? `?${q}` : ""}`);
  },
  getForm: (id: string) => request<FormDetail>(`/api/governance/forms/${id}`),
  createForm: (body: FormCreateBody) =>
    request<FormDetail>("/api/governance/forms", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateForm: (id: string, body: FormUpdateBody) =>
    request<FormDetail>(`/api/governance/forms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteForm: (id: string) =>
    request<void>(`/api/governance/forms/${id}`, { method: "DELETE" }),

  // Messages
  listFormMessages: (formId: string) =>
    request<FormMessageItem[]>(`/api/governance/forms/${formId}/messages`),
  createFormMessage: (formId: string, body: string) =>
    request<FormMessageItem>(`/api/governance/forms/${formId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  updateFormMessage: (formId: string, messageId: string, body: string) =>
    request<FormMessageItem>(
      `/api/governance/forms/${formId}/messages/${messageId}`,
      { method: "PATCH", body: JSON.stringify({ body }) },
    ),
  deleteFormMessage: (formId: string, messageId: string) =>
    request<void>(
      `/api/governance/forms/${formId}/messages/${messageId}`,
      { method: "DELETE" },
    ),

  // Posts
  listPosts: (board: "policy" | "process", params: { mine?: boolean } = {}) => {
    const qs = new URLSearchParams({ board });
    if (params.mine !== undefined) qs.set("mine", String(params.mine));
    return request<GovernancePostItem[]>(`/api/governance/posts?${qs.toString()}`);
  },
  getPost: (id: string) => request<GovernancePostItem>(`/api/governance/posts/${id}`),
};

/** Governance 게시판 게시글 — datahub-web Post 와 동일 의미. */
export interface GovernancePostItem {
  id: string;
  boardType: "policy" | "process";
  docNo: string | null;
  docType: string | null;
  title: string;
  category: string | null;
  content: string;
  isDraft: boolean;
  pinned: boolean;
  visibility: "public" | "admin";
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  summary: string | null;
  tags: string[] | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  appliesTo: string | null;
  tldr: string | null;
  actionItems: string[] | null;
  examples: string | null;
}
