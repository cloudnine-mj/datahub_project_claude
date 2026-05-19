/**
 * Unified API client for data-platform-service.
 *
 * 본 모듈은 BFF route (server-side) 에서만 호출된다. 따라서 dev/stg/prd
 * 클러스터 안에서는 **internal Service URL** 을 사용해 cluster 내부 DNS 로
 * 직접 datahub-api 에 도달한다 (외부 ingress 라운드트립 회피).
 *
 * 우선순위:
 *   1. `PLATFORM_API_INTERNAL_URL`   서버 전용 — Helm values 가 주입한 cluster
 *                                    internal URL (예: http://dh-platform.lgair-datahub.svc.cluster.local:8080)
 *   2. `NEXT_PUBLIC_PLATFORM_API_URL` 외부 도메인 — 클라이언트 측 fetch 가 필요한
 *                                    경우 fallback (브라우저 bundle 에도 포함)
 *   3. localhost                      개발 기본값
 *
 * dev / stg / prd 클러스터는 (1) 을 사용해야 한다 — (2) 는 외부 ingress 를
 * 거치는데, cluster 내부 → 외부 ingress → 다시 내부 dh-platform 라우트는
 * 일부 환경에서 Connect Timeout 회귀를 일으킨다.
 */
const PLATFORM_API_URL =
  process.env.PLATFORM_API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ||
  "http://localhost:8643";

/**
 * datahub-api `ServiceCallerMiddleware` 가 인식하는 service 신원 토큰.
 * 환경별 (dev/stg/prd) 다른 secret value 가 CI `--set` 으로 주입된다.
 *
 * - 본 값이 들어가면 datahub-api 가 caller 를 `datahub-web` 으로 식별하고
 *   `prepare_upload` / `prepare_download` 응답을 `transfer.method="signed-url"`
 *   로 보낸다 (Web Client Limits 적용).
 * - 미설정 시 (예: 로컬 dev) 헤더를 보내지 않고, API 는 default (CAB) 분기를 탄다.
 *   로컬 BFF 가 파일 전송을 직접 수행하지 않는 한 문제 없음.
 *
 * SECURITY: 헤더 위조 시에도 권한 escalation 위험 없음 — Bearer 토큰이 권한 layer 를
 * 담당하고, X-Service-Token 은 channel 분기 (signed-url ↔ CAB) 만 결정한다.
 */
const SERVICE_TOKEN = process.env.DATAHUB_SERVICE_TOKEN;

export class AuthError extends Error {
  constructor() {
    super("Unauthorized — access token expired or invalid");
    this.name = "AuthError";
  }
}

/**
 * datahub-api 가 4xx/5xx 로 응답한 경우의 에러. BFF route 가 ``status`` 와
 * ``detail`` 을 그대로 사용자에게 passthrough 할 수 있도록 두 필드를 노출.
 *
 * 이전 버전은 plain Error 만 던져서 BFF 가 status code 를 알 수 없었고, 그
 * 결과 사용자에게는 항상 generic 500 메시지가 표시되는 회귀가 있었다.
 */
export class UpstreamError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Platform API failed: HTTP ${status} ${detail}`);
    this.name = "UpstreamError";
    this.status = status;
    this.detail = detail;
  }
}

const BASE = `${PLATFORM_API_URL.replace(/\/$/, "")}/api/v1`;

/** Encode a group/repo composite key for use in API paths.
 *  Each path segment is encoded independently so that slashes are preserved. */
function repoApiPath(repo: string): string {
  return repo.split("/").map(encodeURIComponent).join("/");
}

function authHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (SERVICE_TOKEN) {
    h["X-Service-Token"] = SERVICE_TOKEN;
  }
  return h;
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(token),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (res.status === 401) {
    throw new AuthError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // datahub-api 의 detail 필드를 추출해서 BFF 가 사용자에게 그대로 passthrough
    // 할 수 있도록 한다. 응답 형식: {"detail": "<message>"} 또는 {"detail": {...}}
    let detail = body;
    try {
      const parsed = JSON.parse(body);
      const d = parsed?.detail;
      if (typeof d === "string") {
        detail = d;
      } else if (d && typeof d === "object") {
        detail = (d.message as string | undefined) ?? JSON.stringify(d);
      } else if (parsed?.error) {
        // BFF 자체가 4xx 를 만들 때의 형식 ({error: ...})
        detail = String(parsed.error);
      }
    } catch {
      // body 가 JSON 이 아닌 경우는 raw text 그대로
    }
    throw new UpstreamError(res.status, detail);
  }
  return res.json();
}

// ── Catalog ─────────────────────────────────────────

export interface TableInfo {
  full_name: string;
  catalog_name: string;
  schema_name: string;
  table_name: string;
  storage_location: string;
  comment?: string | null;
  table_type?: string | null;
  data_source_format?: string | null;
  properties?: Record<string, string> | null;
}

export interface SearchParams {
  keyword?: string;
  modality?: string;
  task?: string;
  organization?: string;
  data_card_tier?: string;
}

export interface FilterOptions {
  modalities: string[];
  tasks: string[];
  organizations: string[];
  data_card_tiers: string[];
}

export async function searchTables(
  token: string,
  params: SearchParams,
): Promise<TableInfo[]> {
  const sp = new URLSearchParams();
  if (params.keyword) sp.set("keyword", params.keyword);
  if (params.modality) sp.set("modality", params.modality);
  if (params.task) sp.set("task", params.task);
  if (params.organization) sp.set("organization", params.organization);
  if (params.data_card_tier) sp.set("data_card_tier", params.data_card_tier);

  const data = await request<{ tables: TableInfo[] }>(
    `/catalog/search?${sp}`,
    token,
  );
  return data.tables;
}

export async function getTable(
  token: string,
  fullName: string,
): Promise<TableInfo> {
  return request<TableInfo>(`/catalog/tables/${fullName}`, token);
}

export async function updateMetadata(
  token: string,
  fullName: string,
  metadata: Record<string, unknown>,
): Promise<{ status: string }> {
  return request<{ status: string }>(
    `/catalog/tables/${fullName}/metadata`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metadata),
    },
  );
}

export async function getFilterOptions(
  token: string,
): Promise<FilterOptions> {
  return request<FilterOptions>("/catalog/filters", token);
}

// ── Files ───────────────────────────────────────────

export interface LsItem {
  path: string;
  path_type: string;
  size_bytes?: number | null;
  mtime?: number | null;
}

export async function listFiles(
  token: string,
  repo: string,
  ref: string,
  prefix: string,
  recursive = true,
): Promise<{ items: LsItem[]; has_more: boolean; next_offset?: string | null }> {
  const sp = new URLSearchParams({
    branch: ref,
    prefix,
    recursive: String(recursive),
    amount: "1000",
  });
  return request(`/repos/${repoApiPath(repo)}/ls?${sp}`, token);
}

export async function getFileContent(
  token: string,
  repo: string,
  ref: string,
  path: string,
  maxBytes = 10240,
): Promise<{ content: string; total_size: number; truncated: boolean }> {
  const sp = new URLSearchParams({
    ref,
    path,
    max_bytes: String(maxBytes),
  });
  return request(
    `/repos/${repoApiPath(repo)}/content?${sp}`,
    token,
  );
}

// ── Versioning ──────────────────────────────────────

export interface BranchDetail {
  name: string;
  commit_id: string;
  commit_message: string;
  commit_date: number;
}

export async function listBranches(
  token: string,
  repo: string,
): Promise<BranchDetail[]> {
  const data = await request<{ branches: BranchDetail[] }>(
    `/repos/${repoApiPath(repo)}/branches`,
    token,
  );
  return data.branches;
}

export interface CommitLogEntry {
  id: string;
  message: string;
  committer: string;
  creation_date?: number | null;
  parents: string[];
  metadata?: Record<string, string> | null;
}

export async function getCommitLog(
  token: string,
  repo: string,
  ref: string,
  amount = 30,
): Promise<CommitLogEntry[]> {
  const sp = new URLSearchParams({ ref, amount: String(amount) });
  const data = await request<{ results: CommitLogEntry[] }>(
    `/repos/${repoApiPath(repo)}/commits?${sp}`,
    token,
  );
  return data.results;
}

// ── Diff ────────────────────────────────────────────

export interface DiffEntry {
  path: string;
  change_type: "added" | "removed" | "changed";
  path_type: string;
  size_bytes: number | null;
}

export async function getDiff(
  token: string,
  repo: string,
  fromRef: string,
  toRef: string,
): Promise<DiffEntry[]> {
  const sp = new URLSearchParams({ from_ref: fromRef, to_ref: toRef });
  const data = await request<{ entries: DiffEntry[] }>(
    `/repos/${repoApiPath(repo)}/diff?${sp}`,
    token,
  );
  return data.entries;
}

// ── Repo Stats ──────────────────────────────────────

export interface RepoStats {
  repo_name: string;
  owner: string;
  visibility: string;
  branch_count: number;
  commit_count: number;
  file_count: number;
  total_size_bytes: number;
  data_size: string;
  data_count: string;
  last_commit_id: string;
  last_commit_message: string;
  last_commit_date: number;
  data_card_tier: string;
}

export async function getRepoStats(
  token: string,
  repo: string,
): Promise<RepoStats> {
  return request<RepoStats>(
    `/repos/${repoApiPath(repo)}/stats`,
    token,
  );
}

// ── Lineage ─────────────────────────────────────────

export interface LineageEntry {
  id: number;
  source_repo: string;
  derived_repo: string;
  relation_type: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface LineageResponse {
  upstream: LineageEntry[];
  downstream: LineageEntry[];
}

export interface LineageGraph {
  nodes: { repo_name: string; owner: string; visibility: string }[];
  edges: { source: string; target: string; relation_type: string }[];
}

export async function getRepoLineage(
  token: string,
  repo: string,
): Promise<LineageResponse> {
  return request<LineageResponse>(
    `/repos/${repoApiPath(repo)}/lineage`,
    token,
  );
}

export async function createLineage(
  token: string,
  repo: string,
  sourceRepo: string,
  relationType: string,
  description?: string,
): Promise<LineageEntry> {
  return request<LineageEntry>(
    `/repos/${repoApiPath(repo)}/lineage`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_repo: sourceRepo,
        relation_type: relationType,
        description: description || null,
      }),
    },
  );
}

export async function getLineageGraph(
  token: string,
): Promise<LineageGraph> {
  return request<LineageGraph>("/lineage/graph", token);
}

// ── Issues ──────────────────────────────────────────

export interface IssueLabel {
  id: number;
  name: string;
  color: string;
}

export interface IssueUser {
  id: number;
  name: string;
  email: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: IssueLabel[];
  author: IssueUser;
  assignees: IssueUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comment_count: number;
}

export interface IssueComment {
  id: number;
  body: string;
  author: IssueUser;
  created_at: string;
  updated_at: string;
}

export interface ListIssuesParams {
  state?: "open" | "closed" | "all";
  label?: string;
  page?: number;
  per_page?: number;
}

export async function listIssues(
  token: string,
  repo: string,
  params: ListIssuesParams = {},
): Promise<{ issues: Issue[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.state) sp.set("state", params.state);
  if (params.label) sp.set("label", params.label);
  if (params.page) sp.set("page", String(params.page));
  if (params.per_page) sp.set("per_page", String(params.per_page));
  return request(
    `/repos/${repoApiPath(repo)}/issues?${sp}`,
    token,
  );
}

export async function getIssue(
  token: string,
  repo: string,
  issueNumber: number,
): Promise<Issue> {
  return request(
    `/repos/${repoApiPath(repo)}/issues/${issueNumber}`,
    token,
  );
}

export async function createIssue(
  token: string,
  repo: string,
  data: { title: string; body?: string; label_ids?: number[]; assignee_ids?: number[] },
): Promise<Issue> {
  return request(`/repos/${repoApiPath(repo)}/issues`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateIssue(
  token: string,
  repo: string,
  issueNumber: number,
  data: { title?: string; body?: string; state?: "open" | "closed"; label_ids?: number[]; assignee_ids?: number[] },
): Promise<Issue> {
  return request(
    `/repos/${repoApiPath(repo)}/issues/${issueNumber}`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export async function listIssueComments(
  token: string,
  repo: string,
  issueNumber: number,
): Promise<IssueComment[]> {
  const data = await request<{ comments: IssueComment[] }>(
    `/repos/${repoApiPath(repo)}/issues/${issueNumber}/comments`,
    token,
  );
  return data.comments;
}

export async function createIssueComment(
  token: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<IssueComment> {
  return request(
    `/repos/${repoApiPath(repo)}/issues/${issueNumber}/comments`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

// ── Repo Management ─────────────────────────────────

export interface LastCommitInfo {
  hash: string;
  message: string;
  author: string;
  created_at: number; // unix timestamp
}

export interface RepoInfo {
  repo_name: string;
  owner: string;
  role: string;  // 'owner' | 'maintainer' | 'developer' | 'guest' | 'normal'
  visibility: string;  // 'public' | 'private' | 'fine_grained'
  /** governance §Public Access — fine_grained 일 때 비멤버 노출 capability set. */
  public_access?: PublicAccess;
  /** PATCH /visibility 의 optimistic concurrency 토큰. */
  public_access_version?: number;
  description?: string | null;
  repo_type?: "A" | "B" | null; // A=dataset, B=model
  member_count?: number;
  last_commit?: LastCommitInfo | null;
  created_at: string;
  group?: string | null;
}

export interface MetaItem {
  id: string;
  name: string;
}

export interface UserSearchResult {
  id: number;
  email: string;
  name: string;
}

export type VisibilityMode = "public" | "private" | "fine_grained";

export interface PublicAccess {
  discoverable: boolean;
  metadata_read: boolean;
  file_list: boolean;
  file_read: boolean;
  lineage_read: boolean;
  stats_read: boolean;
}

export interface CreateRepoParams {
  repo_name: string;
  description?: string;
  repo_type?: "A" | "B";
  group?: string;
  visibility?: VisibilityMode;
  /** fine_grained 일 때 6 capability 명시 필수 (governance §Formal Model). */
  public_access?: PublicAccess;
  ai_card?: boolean;
  ai_metadata?: boolean;
}

export async function listRepos(token: string): Promise<RepoInfo[]> {
  const data = await request<{ repos: RepoInfo[] }>("/repos", token);
  return data.repos;
}

export async function createRepo(
  token: string,
  params: CreateRepoParams,
): Promise<{
  repo_name: string;
  bucket: string;
  owner: string;
  visibility: VisibilityMode;
  public_access: PublicAccess;
}> {
  return request("/repos", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function listMeta(
  token: string,
  type: "licenses" | "tasks" | "languages" | "frameworks",
): Promise<MetaItem[]> {
  return request<MetaItem[]>(`/meta/${type}`, token);
}

export async function searchUsers(
  token: string,
  q: string,
): Promise<UserSearchResult[]> {
  const sp = new URLSearchParams({ q });
  return request<UserSearchResult[]>(`/users/search?${sp}`, token);
}

export async function getRepo(
  token: string,
  repoName: string,
): Promise<RepoInfo> {
  return request<RepoInfo>(`/repos/${repoApiPath(repoName)}`, token);
}

export async function deleteRepo(
  token: string,
  repoName: string,
): Promise<void> {
  await request(`/repos/${repoApiPath(repoName)}`, token, {
    method: "DELETE",
  });
}

// ── Rename (governance §repo-identity-spec) ─────────────────────

export interface RenameRepoResponse {
  repo_id: string;
  group_id: string | null;
  repo_name: string;
  new_path: string;
  old_path: string;
}

export async function renameRepo(
  token: string,
  repoName: string,
  newName: string,
  reason?: string,
): Promise<RenameRepoResponse> {
  const body: Record<string, unknown> = { new_name: newName };
  if (reason) body.reason = reason;
  return request<RenameRepoResponse>(`/repos/${repoApiPath(repoName)}/name`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface RenameGroupResponse {
  group_id: string;
  new_slug: string;
  old_slug: string;
  affected_repo_count: number;
}

export async function renameGroup(
  token: string,
  groupSlug: string,
  newSlug: string,
  reason?: string,
): Promise<RenameGroupResponse> {
  const body: Record<string, unknown> = { new_slug: newSlug };
  if (reason) body.reason = reason;
  return request<RenameGroupResponse>(`/groups/${encodeURIComponent(groupSlug)}/slug`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface ResolveResponse {
  canonical_group: string;
  canonical_repo: string | null;
  repo_id: string | null;
  group_id: string;
  redirected: boolean;
  chain: Array<{ from: string; to: string }>;
}

/**
 * 옛 path 인지 lookup. 옛 slug 면 redirected=true + canonical 안내.
 * 사용자 북마크 / stale UI route 가 옛 URL 을 호출했을 때 페이지가
 * 이 endpoint 를 먼저 호출해 redirect target 결정.
 */
export async function resolveRepoPath(
  token: string,
  groupSlug: string,
  repoName: string,
): Promise<ResolveResponse> {
  return request<ResolveResponse>(
    `/_resolve/repos/${encodeURIComponent(groupSlug)}/${encodeURIComponent(repoName)}`,
    token,
  );
}

export async function resolveGroupSlug(
  token: string,
  groupSlug: string,
): Promise<ResolveResponse> {
  return request<ResolveResponse>(
    `/_resolve/groups/${encodeURIComponent(groupSlug)}`,
    token,
  );
}

export interface UpdateVisibilityResponse {
  status: string;
  visibility: VisibilityMode;
  public_access: PublicAccess;
  version: number;
}

/**
 * PATCH /repos/{group}/{repo}/visibility (governance §Visibility update).
 * @param version backend optimistic concurrency 토큰 — 호출 전 GET 으로 받은
 *                policy version 을 그대로 전달. 다르면 backend 가 409.
 * @param publicAccess fine_grained visibility 일 때만 명시 (그 외는 백엔드가
 *                     preset 으로 자동 채움).
 */
export async function updateRepoVisibility(
  token: string,
  repoName: string,
  visibility: VisibilityMode,
  version: number,
  publicAccess?: PublicAccess,
): Promise<UpdateVisibilityResponse> {
  const body: Record<string, unknown> = { visibility, version };
  if (publicAccess) body.public_access = publicAccess;
  return request(`/repos/${repoApiPath(repoName)}/visibility`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Permissions ──────────────────────────────────────

export interface PermissionInfo {
  email: string;
  role: string;
  granted_by: string;
}

export async function listPermissions(
  token: string,
  repoName: string,
): Promise<PermissionInfo[]> {
  const data = await request<{ permissions: PermissionInfo[] }>(
    `/repos/${repoApiPath(repoName)}/permissions`,
    token,
  );
  return data.permissions;
}

export async function grantPermission(
  token: string,
  repoName: string,
  email: string,
  role: string,
): Promise<void> {
  await request(`/repos/${repoApiPath(repoName)}/permissions`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
}

export async function revokePermission(
  token: string,
  repoName: string,
  email: string,
): Promise<void> {
  await request(
    `/repos/${repoApiPath(repoName)}/permissions/${encodeURIComponent(email)}`,
    token,
    { method: "DELETE" },
  );
}

// ── Download ────────────────────────────────────────

export interface DownloadEntry {
  path: string;
  signed_url: string;
}

export async function getDownloadUrl(
  token: string,
  repo: string,
  ref: string,
  path: string,
): Promise<DownloadEntry[]> {
  const data = await request<{ files: DownloadEntry[] }>(
    `/repos/${repoApiPath(repo)}/download`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch: ref, paths: [path] }),
    },
  );
  return data.files;
}

// ── Access Tokens v2 (architecture/access-tokens.md §3, §5) ────────────────

export type ResourceType =
  | "user"
  | "repo"
  | "group"
  | "catalog"
  | "snapshot_user"
  | "snapshot";

export type Action =
  | "read"
  | "write"
  | "admin"
  | "delete"
  | "discussion"
  | "access_request_read"
  | "settings_read"
  | "settings_write";

export type TokenType = "read" | "write" | "fine_grained";

export interface Grant {
  resource_type: ResourceType;
  resource_id: string | null;
  action: Action;
}

export interface AccessTokenInfo {
  id: number;
  prefix: string;
  name: string;
  token_type: TokenType;
  created_at: string;
  last_used: string | null;
  expires_at: string | null;
  is_active: boolean;
  revoked_at: string | null;
  grants: Grant[];
}

/**
 * Server response for `create` / `rotate`. ``access_token`` (raw) is returned
 * exactly once and must never be persisted server-side. Callers must surface
 * it to the end user immediately and discard from state on dialog close.
 */
export interface CreatedAccessToken extends AccessTokenInfo {
  access_token: string;
}

export interface CreateAccessTokenParams {
  name: string;
  token_type: TokenType;
  expires_in_days?: number | null;
  grants?: Grant[];
}

export async function listAccessTokens(
  token: string,
  includeRevoked = false,
): Promise<AccessTokenInfo[]> {
  const sp = new URLSearchParams();
  if (includeRevoked) sp.set("include_revoked", "true");
  const qs = sp.toString();
  const data = await request<{ access_tokens: AccessTokenInfo[] }>(
    `/auth/access-tokens${qs ? `?${qs}` : ""}`,
    token,
  );
  return data.access_tokens;
}

export async function createAccessToken(
  token: string,
  params: CreateAccessTokenParams,
): Promise<CreatedAccessToken> {
  return request<CreatedAccessToken>("/auth/access-tokens", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      token_type: params.token_type,
      expires_in_days: params.expires_in_days ?? null,
      grants: params.grants ?? null,
    }),
  });
}

export async function revokeAccessToken(
  token: string,
  ref: string | number,
): Promise<{ status: string; id: number }> {
  return request<{ status: string; id: number }>(
    `/auth/access-tokens/${encodeURIComponent(String(ref))}`,
    token,
    { method: "DELETE" },
  );
}

export async function rotateAccessToken(
  token: string,
  ref: string | number,
): Promise<CreatedAccessToken> {
  return request<CreatedAccessToken>(
    `/auth/access-tokens/${encodeURIComponent(String(ref))}/rotate`,
    token,
    { method: "POST" },
  );
}

// ── 위저드 자동완성 — 본인 권한 보유 자원 ────────────────────────────────

export interface RepoSummary {
  repo_name: string;
  owner: string;
  visibility: string;
  description?: string | null;
  repo_type?: "A" | "B" | null;
  group?: string | null;
}

export interface OrgSummary {
  id: number;
  org_name: string;
  description?: string | null;
  visibility: string;
}

export async function listMyRepos(
  token: string,
  query: string = "",
): Promise<RepoSummary[]> {
  // datahub-api 의 GET /repos 는 본인 접근 가능한 repo 만 반환. query 옵션은
  // 서버가 지원하지 않을 수 있어 클라이언트 측 필터로 fallback (BFF 에서 처리).
  const data = await request<{ repos: RepoSummary[] }>(
    "/repos",
    token,
  );
  if (!query) return data.repos;
  const q = query.toLowerCase();
  return data.repos.filter((r) =>
    r.repo_name.toLowerCase().includes(q) ||
    (r.description ?? "").toLowerCase().includes(q),
  );
}

export async function listMyOrgs(
  token: string,
  query: string = "",
): Promise<OrgSummary[]> {
  // GET /organizations 는 search query 지원
  const sp = new URLSearchParams();
  if (query) sp.set("search", query);
  sp.set("size", "50");
  const data = await request<{ organizations: OrgSummary[] }>(
    `/organizations${sp.toString() ? `?${sp.toString()}` : ""}`,
    token,
  );
  return data.organizations;
}

// ── 한시 호환 alias (구 ApiKey 명) ──────────────────────────────────────
// 외부 caller / 테스트가 아직 ApiKeyInfo / createApiKey 등을 참조할 수 있어
// alias 로 노출. 본 alias 는 0.13 에서 제거 예정.

/** @deprecated Use AccessTokenInfo */
export type ApiKeyInfo = AccessTokenInfo;
/** @deprecated Use CreatedAccessToken */
export type CreatedApiKey = CreatedAccessToken;
/** @deprecated Use CreateAccessTokenParams */
export type CreateApiKeyParams = Omit<CreateAccessTokenParams, "token_type" | "grants"> & {
  scope?: string;
};

/** @deprecated Use listAccessTokens */
export const listApiKeys = listAccessTokens;

/** @deprecated Use createAccessToken with token_type='fine_grained'+grants */
export async function createApiKey(
  token: string,
  params: CreateApiKeyParams,
): Promise<CreatedApiKey> {
  // 호환 — fine_grained + (user, '*', admin) 1 건 grant 자동
  return createAccessToken(token, {
    name: params.name,
    token_type: "fine_grained",
    expires_in_days: params.expires_in_days,
    grants: [{ resource_type: "user", resource_id: "*", action: "admin" }],
  });
}

/** @deprecated Use revokeAccessToken */
export const revokeApiKey = revokeAccessToken;

/** @deprecated Use rotateAccessToken */
export const rotateApiKey = rotateAccessToken;
