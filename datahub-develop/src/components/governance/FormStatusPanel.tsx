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
  ArrowUpFromLine,
  Clock,
  CheckCircle2,
  ChevronDown,
  Eye,
  History,
  MessageCircleWarning,
  MessageSquare,
  Play,
  Reply,
  Send,
  Check,
  Undo2,
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

type ActionCode =
  | "start_review"
  | "approve"
  | "request_info"
  | "resume_review";

interface AdminAction {
  code: ActionCode;
  to: FormStatus;
  label: string;
  cls: string;
  icon: LucideIcon;
  /** 액션 적용 시 진행 이력에 기록할 action 코드. */
  historyAction: "review_started" | "approved" | "info_requested" | "review_resumed";
  /** 코멘트 prefix — 보완 요청만 [보완 요청] 자동 부착. */
  commentPrefix?: string;
}

/** 현재 status 에 따라 표시할 관리자 액션 목록. */
function actionsForStatus(status: FormStatus | string): AdminAction[] {
  switch (status) {
    case "submitted":
      return [
        {
          code: "start_review",
          to: "reviewing",
          label: "검토 시작",
          cls: "bg-blue-500 hover:bg-blue-600",
          icon: Play,
          historyAction: "review_started",
        },
      ];
    case "reviewing":
      return [
        {
          code: "approve",
          to: "approved",
          label: "승인으로 변경",
          cls: "bg-emerald-500 hover:bg-emerald-600",
          icon: Check,
          historyAction: "approved",
        },
        {
          code: "request_info",
          to: "info_requested",
          label: "보완 요청",
          cls: "bg-amber-500 hover:bg-amber-600",
          icon: MessageSquare,
          historyAction: "info_requested",
          commentPrefix: "[보완 요청] ",
        },
      ];
    case "approved":
      return [
        {
          code: "resume_review",
          to: "reviewing",
          label: "검토로 되돌리기",
          cls: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
          icon: Undo2,
          historyAction: "review_resumed",
        },
      ];
    case "info_requested":
      // 버튼 없음 — 신청자 재제출 대기.
      return [];
    default:
      return [];
  }
}

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
  // 현재 상태에서 가능한 관리자 액션 목록 — 상태 전이 그래프대로 분기.
  const availableActions = actionsForStatus(status);
  // 사용자가 선택한 액션 — null 이면 아무 액션도 선택되지 않은 초기 상태.
  const [targetAction, setTargetAction] = useState<AdminAction | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onApply() {
    if (!targetAction) return;
    setError(null);
    setPending(true);
    try {
      const trimmed = comment.trim();
      const finalComment = trimmed.length > 0
        ? `${targetAction.commentPrefix ?? ""}${trimmed}`
        : undefined;
      await api.changeFormStatus(formId, {
        status: targetAction.to,
        comment: finalComment,
        action: targetAction.historyAction,
      });
      setTargetAction(null);
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

      {/* 워크플로우 stepper — 제출됨 → 검토 중 → 보완 요청(조건부) → 승인 완료 */}
      <WorkflowStepper
        status={status}
        hadRevision={
          history?.some(
            (h) => h.action === "info_requested" || /^\s*\[보완\s*요청\]/.test(h.comment ?? ""),
          ) ?? false
        }
      />

      {/* admin 상태 변경 액션 — 단, 본인이 제출한 신청에는 숨김.
          info_requested 상태에서는 버튼 없이 대기 안내만 노출. */}
      {canActAsAdmin && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
            관리자 액션
          </div>
          {availableActions.length === 0 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-amber-700">
              <Clock size={12} aria-hidden="true" />
              {status === "info_requested"
                ? "신청자가 보완 자료를 재제출할 때까지 대기 중입니다."
                : "이 상태에서 가능한 액션이 없습니다."}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {availableActions.map((a) => {
                const Icon = a.icon;
                const active = targetAction?.code === a.code;
                const isOutline = a.cls.startsWith("border");
                return (
                  <button
                    key={a.code}
                    type="button"
                    onClick={() => setTargetAction(active ? null : a)}
                    className={
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition " +
                      (isOutline ? a.cls : "text-white " + a.cls) +
                      (active ? " ring-2 ring-offset-1" : "")
                    }
                  >
                    <Icon size={12} /> {a.label}
                  </button>
                );
              })}
            </div>
          )}

          {targetAction && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50/40 p-3">
              <label className="block text-xs font-semibold text-gray-700">
                코멘트{" "}
                <span className="font-normal text-gray-400">
                  {targetAction.code === "request_info" ? "(보완 요청 내용)" : "(선택)"}
                </span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder={
                  targetAction.code === "request_info"
                    ? "예) 사용 예산 산정 근거를 첨부해 주세요"
                    : "변경 사유나 후속 안내를 입력하세요"
                }
                className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none"
              />
              {error && (
                <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</div>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setTargetAction(null)}
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
        <ol className="relative mt-3 rounded-md p-2">
          {items.map((it, i) => (
            <InlineHistoryRow
              key={it.id ?? `inline-${i}`}
              item={it}
              isLast={i === items.length - 1}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

interface ActionStyle {
  icon: LucideIcon;
  text: string;
  /** 아이콘 배경 + 텍스트 색 */
  iconCls: string;
  /** 행 전체 강조 배경 (옅은) */
  rowBg?: string;
  /** pill 라벨 — 강조 액션만 */
  pillLabel?: string;
  /** pill 배경 + 텍스트 */
  pillCls?: string;
}

const ACTION_STYLE: Record<string, ActionStyle> = {
  제출됨: {
    icon: Send,
    text: "신청서를 제출했습니다",
    iconCls: "bg-blue-50 text-blue-600",
  },
  "검토 시작": {
    icon: Eye,
    text: "검토를 시작했습니다",
    iconCls: "bg-gray-100 text-gray-500",
  },
  "보완 요청": {
    icon: MessageCircleWarning,
    text: "보완을 요청했습니다",
    iconCls: "bg-amber-50 text-amber-600",
    rowBg: "bg-amber-50/60",
    pillLabel: "보완 요청",
    pillCls: "bg-amber-100 text-amber-700",
  },
  "보완 자료 제출": {
    icon: ArrowUpFromLine,
    text: "보완 자료를 제출했습니다",
    iconCls: "bg-blue-50 text-blue-600",
  },
  "검토 재개": {
    icon: Reply,
    text: "검토를 재개했습니다",
    iconCls: "bg-gray-100 text-gray-500",
  },
  "승인 완료": {
    icon: CheckCircle2,
    text: "신청을 승인했습니다",
    iconCls: "bg-emerald-50 text-emerald-600",
    rowBg: "bg-emerald-50/70",
    pillLabel: "승인",
    pillCls: "bg-emerald-100 text-emerald-700",
  },
  "임시 저장": {
    icon: Send,
    text: "임시 저장했습니다",
    iconCls: "bg-gray-100 text-gray-400",
  },
};

const DEFAULT_STYLE: ActionStyle = {
  icon: Send,
  text: "",
  iconCls: "bg-gray-100 text-gray-500",
};

function InlineHistoryRow({
  item,
  isLast,
}: {
  item: StatusHistoryItem;
  isLast: boolean;
}) {
  const style = ACTION_STYLE[item.action] ?? DEFAULT_STYLE;
  const Icon = style.icon;
  // 진행 이력은 시스템 액션 로그만 표시 — 메시지/코멘트 본문은 코멘트 카드에서 다룸.
  return (
    <li
      className={
        "relative flex items-center gap-2.5 rounded-md px-3 py-2 " +
        (style.rowBg ?? "")
      }
    >
      {/* 타임라인 연결선 — 마지막 항목엔 없음 */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[24px] top-[34px] bottom-[-4px] w-px bg-gray-200"
        />
      )}
      <span
        className={
          "z-[1] inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full " +
          style.iconCls
        }
      >
        <Icon size={11} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-gray-800">
        <span className="whitespace-nowrap">
          {item.actor && (
            <span className="font-medium text-gray-900">{item.actor}</span>
          )}
          {item.actor ? "님이 " : ""}
          {style.text || item.action}
        </span>
        {style.pillLabel && (
          <span
            className={
              "rounded-md px-1.5 py-0.5 text-[10px] font-medium " + (style.pillCls ?? "")
            }
          >
            {style.pillLabel}
          </span>
        )}
        <span className="text-[11px] text-gray-400">{item.timestamp}</span>
      </div>
    </li>
  );
}

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

