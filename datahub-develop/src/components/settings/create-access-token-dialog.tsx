"use client";

/**
 * Access Token 발급 위저드 — architecture/access-tokens.md §1 / §2 / §8.1.
 *
 * 3 분기 (탭):
 *   - read           — 발급자의 RBAC 권한 그대로 read 만 (grants 자동: (user, '*', read))
 *   - write          — RBAC 그대로 read+write (grants 자동: (user, '*', write))
 *   - fine_grained   — 4 영역 (User / Repositories / Group / Snapshot) 체크박스
 *                      + repo / group 자동완성 → grants 자동 매핑.
 *
 * 보안 (architecture §11):
 *   - 입력값이 raw token 을 다루지 않으므로 일반 입력 필드.
 *   - 발급 응답의 access_token 은 부모의 AccessTokenCreatedDialog 가 처리.
 */

import { useCallback, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from "lucide-react";

import { TypeaheadInput } from "@/components/settings/typeahead-input";
import type {
  CreatedAccessToken,
  Grant,
  OrgSummary,
  RepoSummary,
  TokenType,
} from "@/lib/platform-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 성공적으로 발급된 토큰. 부모가 Created 다이얼로그를 띄움. */
  onCreated: (created: CreatedAccessToken) => void;
}

type TabKey = "read" | "write" | "fine_grained";

// ── Fine-grained 의 4 영역 ─────────────────────────────────────────────


/** User permissions — 본인 namespace 체크박스 (architecture §2.1). */
interface UserAreaState {
  readSelf: boolean;
  writeSelf: boolean;
  readPublicCatalog: boolean;
  discussionsSelf: boolean;
}

const userAreaInit: UserAreaState = {
  readSelf: false,
  writeSelf: false,
  readPublicCatalog: false,
  discussionsSelf: false,
};


/** Repositories — 선택한 repo 의 read/write/discussion 체크박스 (architecture §2.2). */
interface RepoAreaState {
  selected: RepoSummary[];
  read: boolean;
  write: boolean;
  discussion: boolean;
}

const repoAreaInit: RepoAreaState = {
  selected: [],
  read: false,
  write: false,
  discussion: false,
};


/** Group — 선택한 group 의 read/write/settings_read 체크박스 (architecture §2.3). */
interface GroupAreaState {
  selected: OrgSummary[];
  read: boolean;
  write: boolean;
  settingsRead: boolean;
}

const groupAreaInit: GroupAreaState = {
  selected: [],
  read: false,
  write: false,
  settingsRead: false,
};


/** body 에 보낼 Grant[] 로 변환. */
function buildGrants(
  user: UserAreaState,
  repo: RepoAreaState,
  group: GroupAreaState,
): Grant[] {
  const grants: Grant[] = [];

  if (user.readSelf) grants.push({ resource_type: "user", resource_id: "*", action: "read" });
  if (user.writeSelf) grants.push({ resource_type: "user", resource_id: "*", action: "write" });
  if (user.readPublicCatalog)
    grants.push({ resource_type: "catalog", resource_id: null, action: "read" });
  if (user.discussionsSelf)
    grants.push({ resource_type: "user", resource_id: "*", action: "discussion" });

  for (const r of repo.selected) {
    if (repo.read)
      grants.push({ resource_type: "repo", resource_id: r.repo_name, action: "read" });
    if (repo.write)
      grants.push({ resource_type: "repo", resource_id: r.repo_name, action: "write" });
    if (repo.discussion)
      grants.push({ resource_type: "repo", resource_id: r.repo_name, action: "discussion" });
  }

  for (const g of group.selected) {
    if (group.read)
      grants.push({ resource_type: "group", resource_id: g.org_name, action: "read" });
    if (group.write)
      grants.push({ resource_type: "group", resource_id: g.org_name, action: "write" });
    if (group.settingsRead)
      grants.push({ resource_type: "group", resource_id: g.org_name, action: "settings_read" });
  }

  return grants;
}


// ── 자동완성 fetcher ──────────────────────────────────────────────────


async function searchRepos(q: string): Promise<RepoSummary[]> {
  const res = await fetch(
    `/api/settings/access-tokens/autocomplete/repos${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { repos?: RepoSummary[] };
  return data.repos ?? [];
}

async function searchGroups(q: string): Promise<OrgSummary[]> {
  const res = await fetch(
    `/api/settings/access-tokens/autocomplete/groups${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { groups?: OrgSummary[] };
  return data.groups ?? [];
}


// ── Wizard ────────────────────────────────────────────────────────────


export function CreateAccessTokenDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [tab, setTab] = useState<TabKey>("fine_grained");
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");

  const [userArea, setUserArea] = useState<UserAreaState>(userAreaInit);
  const [repoArea, setRepoArea] = useState<RepoAreaState>(repoAreaInit);
  const [groupArea, setGroupArea] = useState<GroupAreaState>(groupAreaInit);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTab("fine_grained");
    setName("");
    setExpiresInDays("");
    setUserArea(userAreaInit);
    setRepoArea(repoAreaInit);
    setGroupArea(groupAreaInit);
    setError(null);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next && submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  // 자원 chip 추가/제거
  const repoChipKeys = new Set(repoArea.selected.map((r) => r.repo_name));
  const groupChipKeys = new Set(groupArea.selected.map((g) => g.org_name));

  const submit = async () => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("토큰 이름을 입력하세요.");
      return;
    }

    let parsedExpires: number | null = null;
    if (expiresInDays.trim() !== "") {
      const n = Number(expiresInDays);
      if (!Number.isInteger(n) || n <= 0 || n > 1825) {
        setError("만료(일) 는 1..1825 사이의 정수입니다.");
        return;
      }
      parsedExpires = n;
    }

    const body: {
      name: string;
      token_type: TokenType;
      expires_in_days: number | null;
      grants?: Grant[];
    } = {
      name: trimmedName,
      token_type: tab,
      expires_in_days: parsedExpires,
    };

    if (tab === "fine_grained") {
      const grants = buildGrants(userArea, repoArea, groupArea);
      if (grants.length === 0) {
        setError(
          "fine-grained 토큰은 최소 1 개 이상의 권한이 필요합니다. 영역별 체크박스 또는 자원을 선택하세요.",
        );
        return;
      }
      body.grants = grants;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/settings/access-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as
        | CreatedAccessToken
        | { error?: string };
      if (!res.ok) {
        const msg =
          (data && "error" in data ? data.error : null) ??
          `발급 실패 (HTTP ${res.status})`;
        setError(msg);
        return;
      }
      onCreated(data as CreatedAccessToken);
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>새 Access Token 발급</DialogTitle>
          <DialogDescription>
            토큰 종류와 권한 범위를 선택하세요. 발급 후 raw 토큰은 1 회만
            표시됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="token-name">이름</Label>
            <Input
              id="token-name"
              placeholder="이 토큰을 식별할 사람이 읽을 라벨"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-text-secondary">
              나중에 어떤 토큰인지 알아볼 수 있도록 의미가 명확한 이름을
              입력하세요. 발급 후엔 변경할 수 없습니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token-expires">만료 (일)</Label>
            <Input
              id="token-expires"
              type="number"
              min={1}
              max={1825}
              placeholder="비우면 영구 유효"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            />
            <p className="text-xs text-text-secondary">
              1 ~ 1825 일. 비워두면 만료 없이 유지됩니다 (revoke 전까지).
            </p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="read">Read</TabsTrigger>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="fine_grained">Fine-grained</TabsTrigger>
            </TabsList>

            <TabsContent value="read">
              <p className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
                발급자의 RBAC 권한 모델에서 <b>read</b> 만 가능한 모든 자원에
                대해 데이터 조회 + 다운로드를 허용합니다. 별도 권한 입력
                불필요.
              </p>
            </TabsContent>

            <TabsContent value="write">
              <p className="rounded border bg-gray-50 p-3 text-sm text-gray-700">
                발급자의 RBAC 권한 모델에서 <b>write</b> 가능한 모든 자원에
                대해 read + write 를 허용합니다. admin / delete 호출은
                거절됩니다.
              </p>
            </TabsContent>

            <TabsContent value="fine_grained" className="space-y-6 pt-2">
              <p className="text-sm text-text-secondary">
                자원별로 권한을 명시합니다. 각 grant 는 발급자의 RBAC
                매트릭스가 허용한 액션이어야 합니다 (그렇지 않으면 발급 시점에
                거절).
              </p>

              {/* User permissions */}
              <section className="rounded border p-3">
                <h3 className="mb-2 text-sm font-semibold">User permissions</h3>
                <p className="mb-2 text-xs text-text-secondary">
                  본인 namespace 의 자원에 적용됩니다.
                </p>
                <div className="space-y-2">
                  <CheckRow
                    checked={userArea.readSelf}
                    onChange={(v) => setUserArea((s) => ({ ...s, readSelf: v }))}
                    label="본인 소유 모든 repo 의 콘텐츠 read (다운로드 포함)"
                  />
                  <CheckRow
                    checked={userArea.writeSelf}
                    onChange={(v) => setUserArea((s) => ({ ...s, writeSelf: v }))}
                    label="본인 소유 모든 repo 의 콘텐츠/설정 write"
                  />
                  <CheckRow
                    checked={userArea.readPublicCatalog}
                    onChange={(v) =>
                      setUserArea((s) => ({ ...s, readPublicCatalog: v }))
                    }
                    label="다운로드 허용된 public repo 의 콘텐츠 read"
                  />
                  <CheckRow
                    checked={userArea.discussionsSelf}
                    onChange={(v) =>
                      setUserArea((s) => ({ ...s, discussionsSelf: v }))
                    }
                    label="본인 namespace repo 의 discussion / PR 참여"
                  />
                </div>
              </section>

              {/* Repositories permissions */}
              <section className="rounded border p-3">
                <h3 className="mb-2 text-sm font-semibold">
                  Repositories permissions
                </h3>
                <p className="mb-2 text-xs text-text-secondary">
                  특정 repo 만 선택해 권한을 부여합니다 (개수 제한 없음). 본인이
                  접근 가능한 repo + public repo 가 자동완성됩니다.
                </p>

                <div className="mb-2 flex flex-wrap gap-1">
                  {repoArea.selected.map((r) => (
                    <Chip
                      key={r.repo_name}
                      label={r.repo_name}
                      onRemove={() =>
                        setRepoArea((s) => ({
                          ...s,
                          selected: s.selected.filter(
                            (x) => x.repo_name !== r.repo_name,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>

                <TypeaheadInput<RepoSummary>
                  placeholder="repo 검색 (예: nlp-lab/ner-models)"
                  fetchOptions={searchRepos}
                  itemKey={(r) => r.repo_name}
                  renderItem={(r) =>
                    `${r.repo_name} — ${r.visibility}${
                      r.description ? ` · ${r.description}` : ""
                    }`
                  }
                  exclude={repoChipKeys}
                  onSelect={(r) =>
                    setRepoArea((s) => ({
                      ...s,
                      selected: [...s.selected, r],
                    }))
                  }
                />

                <div className="mt-2 space-y-1">
                  <CheckRow
                    checked={repoArea.read}
                    onChange={(v) => setRepoArea((s) => ({ ...s, read: v }))}
                    label="선택한 repo 의 콘텐츠 read"
                  />
                  <CheckRow
                    checked={repoArea.write}
                    onChange={(v) => setRepoArea((s) => ({ ...s, write: v }))}
                    label="선택한 repo 의 콘텐츠/설정 write"
                  />
                  <CheckRow
                    checked={repoArea.discussion}
                    onChange={(v) =>
                      setRepoArea((s) => ({ ...s, discussion: v }))
                    }
                    label="선택한 repo 의 discussion / PR 참여"
                  />
                </div>
              </section>

              {/* Group permissions */}
              <section className="rounded border p-3">
                <h3 className="mb-2 text-sm font-semibold">
                  Group permissions
                </h3>
                <p className="mb-2 text-xs text-text-secondary">
                  본인이 멤버인 그룹 (organization) 만 자동완성. 그룹 내에서도
                  본인의 RBAC 가 허용한 자원에만 토큰이 작동합니다.
                </p>

                <div className="mb-2 flex flex-wrap gap-1">
                  {groupArea.selected.map((g) => (
                    <Chip
                      key={g.org_name}
                      label={g.org_name}
                      onRemove={() =>
                        setGroupArea((s) => ({
                          ...s,
                          selected: s.selected.filter(
                            (x) => x.org_name !== g.org_name,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>

                <TypeaheadInput<OrgSummary>
                  placeholder="group 검색 (예: nlp-lab)"
                  fetchOptions={searchGroups}
                  itemKey={(g) => g.org_name}
                  renderItem={(g) =>
                    `${g.org_name}${g.description ? ` · ${g.description}` : ""}`
                  }
                  exclude={groupChipKeys}
                  onSelect={(g) =>
                    setGroupArea((s) => ({
                      ...s,
                      selected: [...s.selected, g],
                    }))
                  }
                />

                <div className="mt-2 space-y-1">
                  <CheckRow
                    checked={groupArea.read}
                    onChange={(v) => setGroupArea((s) => ({ ...s, read: v }))}
                    label="선택한 group 의 repo 콘텐츠 read"
                  />
                  <CheckRow
                    checked={groupArea.write}
                    onChange={(v) =>
                      setGroupArea((s) => ({ ...s, write: v }))
                    }
                    label="선택한 group 의 repo 콘텐츠/설정 write"
                  />
                  <CheckRow
                    checked={groupArea.settingsRead}
                    onChange={(v) =>
                      setGroupArea((s) => ({ ...s, settingsRead: v }))
                    }
                    label="선택한 group 의 설정 read"
                  />
                </div>
              </section>

              {/* Snapshot — Track B 도착 전 비활성 */}
              <section className="rounded border p-3 opacity-60">
                <h3 className="mb-2 text-sm font-semibold">
                  Snapshot permissions
                </h3>
                <p className="text-xs text-text-secondary">
                  Snapshot 권한 모델은 Track B 도착 후 활성화됩니다 (현재
                  비활성).
                </p>
              </section>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "발급 중..." : "발급"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── 보조 컴포넌트 ─────────────────────────────────────────────────────


function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  );
}


function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
      <code>{label}</code>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`remove ${label}`}
        className="hover:text-blue-900"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
