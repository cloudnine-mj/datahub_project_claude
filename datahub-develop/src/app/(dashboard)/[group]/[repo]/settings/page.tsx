"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const TABS = ["General", "Members", "Danger Zone"] as const;
type Tab = (typeof TABS)[number];

const ROLES = ["maintainer", "developer", "guest"] as const;
type Role = (typeof ROLES)[number];

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-blue-50 text-blue-700",
  maintainer: "bg-orange-50 text-orange-700",
  developer: "bg-green-50 text-green-700",
  guest: "bg-gray-50 text-gray-600",
};

interface Permission {
  email: string;
  role: string;
  granted_by: string;
}

interface SettingsPageProps {
  params: { group: string; repo: string };
}

export default function DatasetSettingsPage({ params }: SettingsPageProps) {
  const router = useRouter();
  const { group, repo } = params;

  const [activeTab, setActiveTab] = useState<Tab>("General");

  // General state
  const [isPublic, setIsPublic] = useState(false);
  const [policyVersion, setPolicyVersion] = useState<number>(1);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [visibilitySaved, setVisibilitySaved] = useState(false);

  // 페이지 진입 시 현재 visibility + version 동기화 (governance: optimistic concurrency)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/repos/${group}/${repo}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setIsPublic(data.visibility !== "private");
        if (typeof data?.public_access_version === "number") {
          setPolicyVersion(data.public_access_version);
        }
      } catch {
        // 무시 — 초기값 사용
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [group, repo]);

  // Members state
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsError, setPermsError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("developer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Danger Zone state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    setPermsLoading(true);
    setPermsError(null);
    try {
      const res = await fetch(`/api/repos/${group}/${repo}/permissions`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setPermissions(data.permissions ?? []);
    } catch (e: any) {
      setPermsError(e.message);
    } finally {
      setPermsLoading(false);
    }
  }, [group, repo]);

  useEffect(() => {
    if (activeTab === "Members") {
      fetchPermissions();
    }
  }, [activeTab, fetchPermissions]);

  const handleSaveVisibility = async () => {
    setSavingVisibility(true);
    setVisibilityError(null);
    setVisibilitySaved(false);
    try {
      const res = await fetch(`/api/repos/${group}/${repo}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: isPublic ? "public" : "private",
          version: policyVersion,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      // 성공 시 새 version 으로 갱신 (다음 변경 시 optimistic concurrency)
      const result = await res.json().catch(() => ({}));
      if (typeof result?.version === "number") {
        setPolicyVersion(result.version);
      }
      setVisibilitySaved(true);
    } catch (e: any) {
      setVisibilityError(e.message);
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/repos/${group}/${repo}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      setInviteEmail("");
      await fetchPermissions();
    } catch (e: any) {
      setInviteError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleChangeRole = async (email: string, role: string) => {
    try {
      const res = await fetch(`/api/repos/${group}/${repo}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      await fetchPermissions();
    } catch (e: any) {
      setPermsError(e.message);
    }
  };

  const handleRevoke = async (email: string) => {
    try {
      const res = await fetch(
        `/api/repos/${group}/${repo}/permissions/${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      await fetchPermissions();
    } catch (e: any) {
      setPermsError(e.message);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== repo) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/repos/${group}/${repo}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed: ${res.status}`);
      }
      router.push("/datasets");
    } catch (e: any) {
      setDeleteError(e.message);
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-dh-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
              activeTab === tab
                ? "border-b-2 border-brand text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* General */}
      {activeTab === "General" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-dh-border p-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Public Repository</p>
              <p className="text-xs text-text-muted mt-0.5">
                공개 설정 시 조직 외부 사용자도 조회할 수 있습니다.
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={(v) => {
                setIsPublic(v);
                setVisibilitySaved(false);
              }}
            />
          </div>
          {visibilityError && <p className="text-xs text-red-600">{visibilityError}</p>}
          {visibilitySaved && <p className="text-xs text-green-600">저장되었습니다.</p>}
          <Button
            className="bg-brand hover:bg-brand/90 text-white"
            onClick={handleSaveVisibility}
            disabled={savingVisibility}
          >
            {savingVisibility ? "저장 중..." : "Save Changes"}
          </Button>
        </div>
      )}

      {/* Members */}
      {activeTab === "Members" && (
        <div className="space-y-4">
          {/* Invite form */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="이메일 주소"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="text-sm flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="h-9 rounded-md border border-dh-border bg-white px-2 text-sm text-text-primary"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-brand hover:bg-brand/90 text-white"
            >
              {inviting ? "초대 중..." : "초대"}
            </Button>
          </div>
          {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}

          {/* Members list */}
          {permsLoading ? (
            <p className="text-sm text-text-muted">불러오는 중...</p>
          ) : permsError ? (
            <p className="text-sm text-red-600">{permsError}</p>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-text-muted">
              멤버가 없습니다. Owner는 별도로 관리됩니다.
            </p>
          ) : (
            <div className="rounded-xl border border-dh-border divide-y divide-dh-border overflow-hidden">
              {permissions.map((p) => (
                <div key={p.email} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-surface border border-dh-border text-xs font-medium text-text-secondary">
                    {p.email[0].toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium text-text-primary truncate">
                    {p.email}
                  </span>
                  <select
                    value={p.role}
                    onChange={(e) => handleChangeRole(p.email, e.target.value)}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${
                      ROLE_BADGE[p.role] ?? "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRevoke(p.email)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors ml-2"
                  >
                    제거
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Danger Zone */}
      {activeTab === "Danger Zone" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50/50 divide-y divide-red-200 overflow-hidden">
            {/* Archive / Transfer — UI only */}
            {[
              {
                title: "Archive this repository",
                desc: "저장소를 아카이브합니다. 읽기 전용이 됩니다.",
                action: "Archive",
              },
              {
                title: "Transfer ownership",
                desc: "저장소를 다른 조직으로 이전합니다.",
                action: "Transfer",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">{item.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>
                </div>
                <Button size="sm" variant="outline" disabled>
                  {item.action}
                </Button>
              </div>
            ))}

            {/* Delete — wired */}
            <div className="p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-red-700">Delete this repository</p>
                <p className="text-xs text-text-muted mt-0.5">
                  모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-text-muted">
                  확인을 위해 저장소 이름{" "}
                  <span className="font-mono font-semibold text-text-primary">{repo}</span>을
                  입력하세요.
                </Label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={repo}
                  className="text-sm max-w-xs border-red-200 focus:border-red-400"
                />
              </div>
              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== repo}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {deleting ? "삭제 중..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
