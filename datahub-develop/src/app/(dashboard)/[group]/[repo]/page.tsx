"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Database, GitBranch, Users, Upload, Lock } from "lucide-react";
import { VisibilityBadge } from "@/components/repo/VisibilityBadge";
import { Button } from "@/components/ui/button";
import type { RepoInfo, PublicAccess } from "@/lib/platform-client";

/** 멤버 role 인지 판정 — 비멤버는 'normal' (governance 08-roles). */
function isMember(role: string | undefined): boolean {
  return !!role && role !== "normal";
}

/** capability key 가 비멤버에게 허용되는지. 멤버는 항상 true. */
function hasCapability(
  data: Pick<RepoInfo, "role" | "public_access">,
  cap: keyof PublicAccess,
): boolean {
  if (isMember(data.role)) return true;
  return !!data.public_access?.[cap];
}

function formatRelativeTime(unixTs: number): string {
  const diff = Math.floor((Date.now() / 1000) - unixTs);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function RepoOverviewPage() {
  const { group, repo } = useParams<{ group: string; repo: string }>();
  const [data, setData] = useState<RepoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!group || !repo) return;
    fetch(`/api/repos/${group}/${repo}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((d: RepoInfo) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [group, repo]);

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6 animate-pulse">
        <div className="h-10 bg-bg-surface rounded-lg w-1/3" />
        <div className="h-4 bg-bg-surface rounded w-2/3" />
        <div className="h-16 bg-bg-surface rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl">
        <p className="text-sm text-text-secondary">레포지토리를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const lastCommit = data.last_commit ?? null;
  const member = isMember(data.role);
  // 비멤버 view 의 quick link 별 가용성 (governance §Permission Evaluation)
  const canFileList = hasCapability(data, "file_list");
  const canFileRead = hasCapability(data, "file_read");
  // 버전 기록은 governance 6 capability 에 별도 키가 없어 file_list 와 동등 처리.
  const canVersions = canFileList;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Repo Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
            <Database className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-semibold text-text-primary">{repo}</h1>
            {data.description && (
              <p className="text-sm text-text-secondary">{data.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Upload 은 쓰기 권한 (developer 이상). 비멤버에겐 노출하지 않음. */}
          {member && (
            <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white gap-1.5">
              <Link href={`/${group}/${repo}/browser`}>
                <Upload className="h-3.5 w-3.5" />
                Upload
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm text-text-secondary border-b border-dh-border pb-4">
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" />
          <Link href={`/${group}/${repo}/versions`} className="hover:text-text-primary">main</Link>
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {data.member_count ?? 0}명
        </span>
        <span className="flex items-center gap-1.5">
          <VisibilityBadge visibility={data.visibility} size="md" />
        </span>
      </div>

      {/* Last Commit */}
      {lastCommit && (
        <div className="flex items-center gap-3 rounded-lg border border-dh-border bg-bg-surface px-4 py-2.5 text-sm">
          <Users className="h-4 w-4 text-text-muted" />
          <span className="flex-1 text-text-secondary truncate">{lastCommit.message}</span>
          <span className="text-xs text-text-muted">{formatRelativeTime(lastCommit.created_at)}</span>
        </div>
      )}

      {/* Quick Links — 비멤버는 capability 에 따라 disable + Member-only 안내 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <QuickLink
          href={`/${group}/${repo}/browser`}
          label="파일 브라우저"
          enabled={canFileList}
        />
        <QuickLink
          href={`/${group}/${repo}/versions`}
          label="버전 기록"
          enabled={canVersions}
        />
        <QuickLink
          href={`/${group}/${repo}/explorer`}
          label="데이터 탐색기"
          enabled={canFileRead}
        />
      </div>

      {!member && data.visibility === "fine_grained" && (
        <NonMemberNotice publicAccess={data.public_access} />
      )}
    </div>
  );
}

/** Quick link 카드 — enabled=false 면 클릭 차단 + 🔒 표시. */
function QuickLink({
  href,
  label,
  enabled,
}: {
  href: string;
  label: string;
  enabled: boolean;
}) {
  if (enabled) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-dh-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:bg-bg-subtle transition-colors"
      >
        {label} →
      </Link>
    );
  }
  return (
    <div
      role="button"
      aria-disabled
      title="이 항목은 멤버 권한이 필요합니다"
      className="rounded-xl border border-dh-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-muted opacity-60 cursor-not-allowed flex items-center gap-1.5"
    >
      <Lock className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

/** Fine-grained 비멤버 view 시, 어떤 capability 가 차단됐는지 한 곳에 안내. */
function NonMemberNotice({
  publicAccess,
}: {
  publicAccess: PublicAccess | undefined;
}) {
  if (!publicAccess) return null;
  const blocked = (
    [
      ["file_list", "폴더·파일 목록"],
      ["file_read", "다운로드"],
      ["lineage_read", "Lineage"],
      ["stats_read", "통계"],
    ] as [keyof PublicAccess, string][]
  )
    .filter(([k]) => !publicAccess[k])
    .map(([, label]) => label);
  if (blocked.length === 0) return null;
  return (
    <div className="rounded-lg border border-dh-border bg-bg-surface p-3 text-sm text-text-secondary flex items-start gap-2">
      <Lock className="h-4 w-4 mt-0.5 text-text-muted flex-shrink-0" />
      <div>
        <p className="font-medium text-text-primary">Member only</p>
        <p className="text-xs text-text-muted mt-0.5">
          이 저장소는 fine-grained 공개로 다음 항목이 비공개입니다: {blocked.join(", ")}.
          접근하려면 저장소 멤버 권한을 요청하세요.
        </p>
      </div>
    </div>
  );
}
