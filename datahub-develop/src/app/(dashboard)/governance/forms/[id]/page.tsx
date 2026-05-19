/**
 * 거버넌스 요청 상세 — datahub-web `/governance/forms/detail/[id]` 포팅.
 *
 * read-only 신청 본문 + 진행 이력 + 양방향 채팅(ProgressHistoryBlock).
 * 채팅 역할은 `getChatRole(form, me)` 로 자동 판정 (applicant/assignee/admin/observer).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { governanceApi } from "@/lib/governance/api-client";
import type { FormDetail, FormStatus } from "@/lib/governance/forms/types";
import { ProgressHistoryBlock } from "@/components/governance/forms/progress-history-block";
import { getChatRole } from "@/lib/governance/forms/get-chat-role";
import { approvalHistoryToStatusItems } from "@/lib/governance/forms/history-adapter";

const statusLabel: Record<FormStatus, string> = {
  draft: "임시 저장",
  submitted: "제출됨",
  reviewing: "검토 중",
  approved: "승인 완료",
  rejected: "반려",
};

interface PageProps {
  params: { id: string };
}

interface Me {
  email: string;
  name?: string;
  role?: string;
}

export default function Page({ params }: PageProps) {
  const [form, setForm] = useState<FormDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    governanceApi
      .getForm(params.id)
      .then((f) => {
        if (!cancelled) setForm(f);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    // 로그인 사용자 — /api/auth/me 에서 받음. 실패하면 observer 로 fallback.
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: Me } | null) => {
        if (!cancelled && data?.user) setMe(data.user);
      })
      .catch(() => {
        /* observer fallback */
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!form) {
    return <div className="text-sm text-text-muted">불러오는 중...</div>;
  }

  const chatRole = getChatRole(form, me);
  const isObserver = chatRole === "observer";

  return (
    <div className="space-y-6">
      <Link
        href="/governance/forms/list"
        className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-brand"
      >
        <ArrowLeft className="h-3 w-3" />
        요청 목록으로 돌아가기
      </Link>

      <header>
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          {form.requestNo}
        </div>
        <h1 className="mt-1 font-heading text-2xl font-semibold text-text-primary">
          {form.projectName}
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
          <span className="inline-flex rounded-full border border-dh-border bg-bg-surface px-2 py-0.5 text-[11px]">
            {statusLabel[form.status]}
          </span>
          <span>·</span>
          <span>{form.submitterName}</span>
          <span>·</span>
          <span>{new Date(form.submittedAt).toLocaleString("ko-KR")}</span>
        </div>
      </header>

      <section className="rounded-xl border border-dh-border bg-white p-5">
        <h2 className="text-sm font-medium text-text-primary mb-3">신청 내용</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[180px_1fr]">
          <dt className="text-text-secondary">신청자</dt>
          <dd className="text-text-primary">{form.submitterName}</dd>
          <dt className="text-text-secondary">이메일</dt>
          <dd className="text-text-primary">{form.submitterEmail}</dd>
          <dt className="text-text-secondary">소속</dt>
          <dd className="text-text-primary">{form.submitterDepartment ?? "-"}</dd>
          {Object.entries(form.payload).map(([key, value]) =>
            value === undefined || value === null || value === "" ? null : (
              <FieldRow key={key} field={key} value={value} />
            ),
          )}
        </dl>
      </section>

      {!isObserver && (
        <ProgressHistoryBlock
          formId={form.id}
          history={approvalHistoryToStatusItems(
            (form.approvalHistory ?? []).map(normalizeApprovalEntry),
            form.submitterName,
          )}
          canPostMessage
          currentUserName={me?.name ?? "나"}
          currentUserRole={chatRole}
          applicantName={form.submitterName}
        />
      )}
    </div>
  );
}

/** snake_case (옛 SQLite seed) 와 camelCase (Prisma) 양쪽 호환 — history-adapter 가 받는 형식으로 정규화. */
function normalizeApprovalEntry(e: {
  status: string;
  changedBy?: string;
  changed_by?: string;
  changedAt?: string;
  changed_at?: string;
  comment: string | null;
}) {
  return {
    status: e.status as FormStatus,
    changed_by: e.changedBy ?? e.changed_by ?? "",
    changed_at: e.changedAt ?? e.changed_at ?? "",
    comment: e.comment,
  };
}

function FieldRow({ field, value }: { field: string; value: unknown }) {
  let display: string;
  if (typeof value === "boolean") display = value ? "✓ 확인 완료" : "확인 필요";
  else if (Array.isArray(value)) display = value.join(", ");
  else if (typeof value === "object") display = JSON.stringify(value);
  else display = String(value);
  return (
    <>
      <dt className="text-text-secondary">{field}</dt>
      <dd className="text-text-primary whitespace-pre-wrap">{display}</dd>
    </>
  );
}
