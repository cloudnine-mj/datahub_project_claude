"use client";

/**
 * `/settings/access-tokens` — Access Token 관리 페이지.
 *
 * architecture/access-tokens.md §8.1 와이어프레임 구현. 옛 `/settings/api-keys`
 * 의 v2 후속이며, 본 페이지는 datahub-api 의 `/auth/access-tokens` 4 endpoint
 * 를 BFF (`/api/settings/access-tokens`) 경유로 호출.
 */

import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";

import type {
  AccessTokenInfo,
  CreatedAccessToken,
} from "@/lib/platform-client";
import { CreateAccessTokenDialog } from "@/components/settings/create-access-token-dialog";
import { AccessTokenCreatedDialog } from "@/components/settings/access-token-created-dialog";

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function grantsSummary(grants: AccessTokenInfo["grants"]): string {
  if (!grants || grants.length === 0) return "-";
  if (grants.length === 1) {
    const g = grants[0];
    return `${g.resource_type}:${g.resource_id ?? "*"}:${g.action}`;
  }
  return `${grants.length} grants`;
}

export default function AccessTokensSettingsPage() {
  const [tokens, setTokens] = useState<AccessTokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedAccessToken | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = includeRevoked ? "?include_revoked=true" : "";
      const res = await fetch(`/api/settings/access-tokens${sp}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          data.error ?? `목록을 불러오지 못했습니다 (HTTP ${res.status}).`,
        );
        setTokens([]);
        return;
      }
      const data = (await res.json()) as { access_tokens: AccessTokenInfo[] };
      setTokens(data.access_tokens ?? []);
    } catch (err) {
      console.error(err);
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [includeRevoked]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (t: AccessTokenInfo) => {
    if (
      !window.confirm(
        `"${t.name}" 토큰 (${t.prefix}…) 을 즉시 비활성화합니다. 진행할까요?`,
      )
    ) {
      return;
    }
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/settings/access-tokens/${t.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `revoke 실패 (HTTP ${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const rotate = async (t: AccessTokenInfo) => {
    if (
      !window.confirm(
        `"${t.name}" 토큰을 회전합니다. 기존은 즉시 revoke 되고 새 토큰이 발급됩니다. 계속할까요?`,
      )
    ) {
      return;
    }
    setBusyId(t.id);
    try {
      const res = await fetch(`/api/settings/access-tokens/${t.id}/rotate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? `rotate 실패 (HTTP ${res.status})`);
        return;
      }
      const created = (await res.json()) as CreatedAccessToken;
      await load();
      setCreatedToken(created);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <KeyRound className="h-6 w-6" />
            Access Tokens
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            CLI · SDK · 외부 통합용 access token 을 관리합니다. 발급된 raw
            token 은 1회만 노출되므로 안전한 곳에 보관하세요.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />새 Access Token
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-base">발급된 토큰</CardTitle>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(e) => setIncludeRevoked(e.target.checked)}
            />
            revoke 된 토큰 포함
          </label>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">
              불러오는 중...
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-500">{error}</p>
          ) : tokens.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              발급된 토큰이 없습니다. 우측 상단 &quot;새 Access Token&quot; 으로 생성하세요.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Grants</TableHead>
                  <TableHead>생성</TableHead>
                  <TableHead>마지막 사용</TableHead>
                  <TableHead>만료</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => {
                  const isBusy = busyId === t.id;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.name || "-"}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                          {t.prefix}…
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.token_type}</Badge>
                      </TableCell>
                      <TableCell
                        className="text-xs text-text-secondary"
                        title={t.grants
                          .map(
                            (g) =>
                              `${g.resource_type}:${g.resource_id ?? "*"}:${g.action}`,
                          )
                          .join("\n")}
                      >
                        {grantsSummary(t.grants)}
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">
                        {formatDate(t.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">
                        {formatDate(t.last_used)}
                      </TableCell>
                      <TableCell className="text-sm text-text-secondary">
                        {t.expires_at ? formatDate(t.expires_at) : "영구"}
                      </TableCell>
                      <TableCell>
                        {t.is_active ? (
                          <Badge variant="default">활성</Badge>
                        ) : (
                          <Badge variant="secondary">revoke</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.is_active ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => rotate(t)}
                              disabled={isBusy}
                              title="토큰 회전 (이전 토큰 즉시 revoke)"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={() => revoke(t)}
                              disabled={isBusy}
                              title="revoke"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-text-secondary">
                            {t.revoked_at ? formatDate(t.revoked_at) : "revoked"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateAccessTokenDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          setCreatedToken(created);
          load();
        }}
      />
      <AccessTokenCreatedDialog
        created={createdToken}
        onClose={() => setCreatedToken(null)}
      />
    </div>
  );
}
