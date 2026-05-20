"use client";

/**
 * 신청 상태 패널 — 신청 상세 페이지에 표시.
 *
 *  - 모든 사용자: 현재 상태 + 승인 이력 타임라인
 *  - admin: 상태 변경 액션 (검토 시작 / 승인 / 반려) + 코멘트 입력
 *
 * 상태 변경 후 부모(`onChanged`)가 신청 데이터를 재조회.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Eye,
  History,
  MessageSquare,
  Play,
  Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, type ApprovalEntry, type FormStatus, type Me } from "@/lib/governance/api-client-full";
import { parseUtc } from "@/lib/governance/forms/utils-bridge";
import type { StatusHistoryItem } from "@/lib/governance/forms/application-config";
import { StatusBadge } from "./StatusBadge";
import { WorkflowStepper } from "./WorkflowStepper";

interface Props {
  formId: string | number;
  status: FormStatus | string;
  history: ApprovalEntry[] | null;
  me: Me | null;
  /** 신청 제출자 이메일 — admin 이라도 본인 신청에는 액션 숨김 (자기 결재 방지) */
  submitterEmail?: string | null;
  onChanged: () => void;
  /** 관리자 액션 아래에 진행 이력(시스템 이벤트) 토글 섹션을 표시. 거버넌스 요청 관리(관리자 상세)
   *  + 거버넌스 요청 목록(read-only) 에서 true 로 사용. 시스템 이벤트만 노출,
   *  '시스템 이벤트 포함' 체크박스 없음. */
  inlineHistory?: StatusHistoryItem[];
  /** 관리자 액션 영역을 강제로 숨김 — read-only 컨텍스트(요청 목록 진입) 에서 true.
   *  내부적으로 canActAsAdmin 이 true 라도 버튼을 노출하지 않음. */
  hideAdminActions?: boolean;
}

const TRANSITIONS: { to: FormStatus; label: string; cls: string; icon: typeof Play }[] = [
  { to: "reviewing", label: "검토 시작", cls: "bg-amber-500 hover:bg-amber-600", icon: Play },
  { to: "approved", label: "승인", cls: "bg-emerald-500 hover:bg-emerald-600", icon: Check },
];

export function FormStatusPanel({
  formId,
  status,
  history,
  me,
  submitterEmail,
  onChanged,
  inlineHistory,
  hideAdminActions = false,
}: Props) {
  const router = useRouter();
  const isAdmin = me?.user.role === "admin";
  const isOwnSubmission = !!me && !!submitterEmail && me.user.email === submitterEmail;
  const canActAsAdmin = isAdmin && !isOwnSubmission && !hideAdminActions;
  const [target, setTarget] = useState<FormStatus | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 진행 이력 펼침/접힘 — 기본 접힘. 사용자가 필요할 때만 펼쳐서 봄.
  const [historyOpen, setHistoryOpen] = useState(false);

  async function onApply() {
    if (!target) return;
    setError(null);
    setPending(true);
    try {
      // '보완 요청' 은 status 를 '검토 중'(reviewing) 으로 되돌리고 [보완 요청] 코멘트 기록.
      // 승인 완료된 신청도 보완 요청 시 다시 검토 단계로 내려가야 신청자가 후속 조치 가능.
      const isSupplement = (target as string) === "__supplement__";
      const finalStatus = isSupplement ? "reviewing" : target;
      const finalComment = isSupplement
        ? `[보완 요청] ${comment || ""}`.trim()
        : comment || undefined;
      // PATCH /status 가 코멘트 본문이 있으면 GovernanceFormMessage 도 함께 생성.
      // 백엔드 transaction 으로 atomic 하게 처리하므로 frontend 에서는 한 번만 호출.
      await api.changeFormStatus(formId, {
        status: finalStatus as FormStatus,
        comment: finalComment || undefined,
      });
      setTarget(null);
      setComment("");
      onChanged();
      // 거버넌스 요청 목록 / 관리 페이지 등 다른 라우트의 Next.js Router Cache 무효화 —
      // 사용자가 목록으로 돌아가면 변경된 status 가 즉시 반영됨.
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">진행 상태</h2>
        <StatusBadge status={status} />
      </div>

      {/* 워크플로우 stepper — 임시저장 → 제출됨 → 검토 중 → 승인 완료 (반려 시 별도 분기) */}
      <WorkflowStepper status={status} />

      {/* admin 상태 변경 액션 — 단, 본인이 제출한 신청에는 숨김 */}
      {canActAsAdmin && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
            관리자 액션
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {TRANSITIONS.filter((t) => t.to !== status).map((t) => {
              const Icon = t.icon;
              const active = target === t.to;
              return (
                <button
                  key={t.to}
                  type="button"
                  onClick={() => setTarget(active ? null : t.to)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition " +
                    (active ? t.cls + " ring-2 ring-offset-1" : t.cls + " opacity-90")
                  }
                >
                  <Icon size={12} /> {t.label === "검토 시작" ? "검토 시작으로 변경" : t.label === "승인" ? "승인으로 변경" : t.label}
                </button>
              );
            })}
            {/* 보완 요청 — 상태 전환 없이 코멘트만 기록. status 그대로 유지. */}
            <button
              type="button"
              onClick={() => setTarget(target === "__supplement__" ? null : ("__supplement__" as FormStatus))}
              className={
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition " +
                (target === "__supplement__"
                  ? "border-gray-300 bg-gray-100 text-gray-900"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50")
              }
            >
              <MessageSquare size={12} /> 보완 요청
            </button>
          </div>

          {target && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/40 p-3">
              <label className="block text-xs font-semibold text-gray-700">
                코멘트 <span className="font-normal text-gray-400">(선택)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="변경 사유나 후속 안내를 입력하세요"
                className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none"
              />
              {error && (
                <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</div>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setTarget(null)}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onApply}
                  className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {pending ? "변경 중..." : "변경 확정"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* 진행 이력 토글 — inlineHistory 를 받은 경우(관리자 상세 진입)만 노출.
          시스템 이벤트만 표시, '시스템 이벤트 포함' 체크박스 없음. */}
      {inlineHistory && inlineHistory.length > 0 && (
        <InlineHistorySection items={inlineHistory} />
      )}
    </section>
    </>
  );
}

/**
 * 진행 이력 토글 섹션 — 진행 상태 카드 내 관리자 액션 아래에 배치.
 *   - 시스템 이벤트만 표시 (사람 코멘트는 별도 코멘트 카드에서 처리)
 *   - '시스템 이벤트 포함' 체크박스 없음
 *   - 기본 접힘. 헤더 클릭으로 펼침/접힘.
 */
function InlineHistorySection({ items }: { items: StatusHistoryItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-500">
          <History size={13} aria-hidden="true" />
          진행 이력
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
            {items.length}건
          </span>
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={"text-gray-400 transition-transform " + (open ? "" : "-rotate-90")}
        />
      </button>

      {open && (
        <ul className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
          {items.map((it, i) => {
            const Icon = INLINE_HISTORY_ICON[it.action] ?? Send;
            return (
              <li
                key={it.id ?? `inline-${i}`}
                className="flex items-start gap-2.5 border-b border-gray-200 pb-2 last:border-b-0 last:pb-0"
              >
                <span className="mt-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white text-gray-500">
                  <Icon size={11} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-gray-800">
                    {it.actor ? `${it.actor}이 ` : ""}
                    {INLINE_HISTORY_TEXT[it.action] ?? it.action}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {it.timestamp} · 시스템
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const INLINE_HISTORY_ICON: Record<string, LucideIcon> = {
  "임시 저장": Send,
  제출됨: Send,
  "검토 시작": Eye,
  "승인 완료": Check,
};

const INLINE_HISTORY_TEXT: Record<string, string> = {
  "임시 저장": "신청서를 임시 저장했습니다",
  제출됨: "신청서를 제출했습니다",
  "검토 시작": "검토를 시작했습니다",
  "승인 완료": "신청을 승인했습니다",
};

function dotColor(s: string): string {
  return s === "approved"
    ? "bg-emerald-500"
    : s === "rejected"
    ? "bg-red-500"
    : s === "reviewing"
    ? "bg-amber-500"
    : s === "submitted"
    ? "bg-blue-500"
    : "bg-gray-400";
}

function formatTimeline(iso: string): string {
  try {
    const d = parseUtc(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
  } catch {
    return iso;
  }
}

