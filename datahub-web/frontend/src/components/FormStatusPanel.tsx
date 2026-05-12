"use client";

/**
 * 신청서 상태 패널 — 신청서 상세 페이지에 표시.
 *
 *  - 모든 사용자: 현재 상태 + 승인 이력 타임라인
 *  - admin: 상태 변경 액션 (검토 시작 / 승인 / 반려) + 코멘트 입력
 *
 * 상태 변경 후 부모(`onChanged`)가 신청서 데이터를 재조회.
 */

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, MessageSquare, Play } from "lucide-react";
import { api, type ApprovalEntry, type FormStatus, type Me } from "@/lib/api";
import { parseUtc } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

interface Props {
  formId: number;
  status: FormStatus | string;
  history: ApprovalEntry[] | null;
  me: Me | null;
  /** 신청서 제출자 이메일 — admin 이라도 본인 신청서에는 액션 숨김 (자기 결재 방지) */
  submitterEmail?: string | null;
  onChanged: () => void;
}

const TRANSITIONS: { to: FormStatus; label: string; cls: string; icon: typeof Play }[] = [
  { to: "reviewing", label: "검토 시작", cls: "bg-amber-500 hover:bg-amber-600", icon: Play },
  { to: "approved", label: "승인", cls: "bg-emerald-500 hover:bg-emerald-600", icon: Check },
];

export function FormStatusPanel({ formId, status, history, me, submitterEmail, onChanged }: Props) {
  const isAdmin = me?.user.role === "admin";
  const isOwnSubmission = !!me && !!submitterEmail && me.user.email === submitterEmail;
  const canActAsAdmin = isAdmin && !isOwnSubmission;
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
      await api.changeFormStatus(formId, { status: target, comment: comment || undefined });
      setTarget(null);
      setComment("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">진행 상태</h2>
        <StatusBadge status={status} />
      </div>

      {/* 워크플로우 stepper — 임시저장 → 제출됨 → 검토 중 → 승인 완료 (반려 시 별도 분기) */}
      <WorkflowStepper status={status} />

      {/* 타임라인 — 이력 있을 때만 노출. 부모 카드(흰 배경) 안의 sub-panel 이므로 미묘한
          double-border 를 피하기 위해 회색 배경(bg-gray-50) + border 없이 구분. */}
      {history && history.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg bg-gray-50">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className={
              "flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-100/80 " +
              (historyOpen ? "border-b border-gray-200/70" : "")
            }
          >
            <ChevronDown
              size={16}
              className={"shrink-0 text-gray-500 transition " + (historyOpen ? "" : "-rotate-90")}
            />
            <span>진행 이력</span>
            <span className="text-xs font-semibold text-gray-400">{history.length}건</span>
            <span className="ml-auto text-xs font-medium text-gray-400">
              {historyOpen ? "접기" : "펼치기"}
            </span>
          </button>

          {historyOpen && (
            <ol className="space-y-3 border-l-2 border-gray-200/70 px-6 py-4 pl-9">
              {history.map((h, i) => (
                <li key={i} className="relative">
                  <span
                    className={
                      "absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-gray-50 " +
                      dotColor(h.status)
                    }
                  />
                  <div className="flex flex-wrap items-baseline gap-2 text-sm">
                    <StatusBadge status={h.status} />
                    <span className="font-medium text-gray-700">{h.changed_by}</span>
                    <span className="text-xs text-gray-400">{formatTimeline(h.changed_at)}</span>
                  </div>
                  {h.comment && (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-600">
                      <MessageSquare size={12} className="mt-0.5 shrink-0 text-gray-400" />
                      <span>{h.comment}</span>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* admin 상태 변경 액션 — 단, 본인이 제출한 신청서에는 숨김 */}
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
                  <Icon size={12} /> {t.label}으로 변경
                </button>
              );
            })}
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
    </section>
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

/**
 * 워크플로우 stepper — 작성 → 결재 흐름.
 *   [임시저장] ▶ 제출됨 ── 검토 중 ──┬── 승인 완료
 *   (점선)                            └── 반려
 * 임시저장은 작성자 단계 (프리 스테이지) 라 점선 테두리로 구분.
 * 종착 분기는 항상 표시 — 현재 상태에 따라 한쪽 활성.
 */
function WorkflowStepper({ status }: { status: FormStatus | string }) {
  const isDraft = status === "draft";
  const reachedSubmitted = ["submitted", "reviewing", "approved", "rejected"].includes(status as string);
  const reachedReviewing = ["reviewing", "approved", "rejected"].includes(status as string);
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const reachedTerminal = isApproved || isRejected;

  return (
    <div className="mt-4 inline-flex items-center gap-3">
      {/* 0) 임시저장 — 프리 스테이지 (점선) */}
      <DraftNode current={isDraft} passed={reachedSubmitted} />
      <span className={"h-0.5 w-14 " + (reachedSubmitted ? "bg-blue-500" : "bg-gray-200")} />

      {/* 1) 제출됨 */}
      <StepNode label="제출됨" reached={reachedSubmitted} current={status === "submitted"} index={1} />
      <span className={"h-0.5 w-14 " + (reachedReviewing ? "bg-blue-500" : "bg-gray-200")} />

      {/* 2) 검토 중 */}
      <StepNode label="검토 중" reached={reachedReviewing} current={status === "reviewing"} index={2} />
      <span className={"h-0.5 w-14 " + (reachedTerminal ? "bg-blue-500" : "bg-gray-200")} />

      {/* 3) 종착 — 기본은 '승인 완료' 단독 노출. 실제로 반려된 신청서일 때만 '반려' 노드를 보여 사실 반영. */}
      <div className="flex flex-col gap-1.5">
        <TerminalNode label="승인 완료" tone="approved" active={isApproved} muted={isRejected} />
        {isRejected && (
          <TerminalNode label="반려" tone="rejected" active={isRejected} muted={isApproved} />
        )}
      </div>
    </div>
  );
}

function DraftNode({ current, passed }: { current: boolean; passed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={
          "grid h-7 w-7 place-items-center rounded-full border-2 border-dashed text-xs font-semibold transition " +
          (current
            ? "border-gray-500 bg-gray-100 text-gray-700"
            : passed
            ? "border-gray-300 bg-gray-50 text-gray-400"
            : "border-gray-300 bg-white text-gray-400")
        }
      >
        {passed ? <Check size={13} /> : "✎"}
      </span>
      <span
        className={
          "mt-1 whitespace-nowrap text-[11px] font-semibold " +
          (current ? "text-gray-800" : passed ? "text-gray-500" : "text-gray-400")
        }
      >
        임시저장
      </span>
    </div>
  );
}

function StepNode({
  label,
  reached,
  current,
  index,
}: {
  label: string;
  reached: boolean;
  current: boolean;
  index: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={
          "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition " +
          (reached
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-gray-200 bg-white text-gray-400")
        }
      >
        {reached && !current ? <Check size={13} /> : index}
      </span>
      <span
        className={
          "mt-1 whitespace-nowrap text-[11px] font-semibold " +
          (current ? "text-blue-700" : reached ? "text-gray-700" : "text-gray-400")
        }
      >
        {label}
      </span>
    </div>
  );
}

function TerminalNode({
  label,
  tone,
  active,
  muted,
}: {
  label: string;
  tone: "approved" | "rejected";
  active: boolean;
  muted: boolean;
}) {
  let dotCls: string;
  let labelCls: string;
  if (active && tone === "approved") {
    dotCls = "border-emerald-500 bg-emerald-500 text-white";
    labelCls = "text-emerald-600";
  } else if (active && tone === "rejected") {
    dotCls = "border-red-500 bg-red-500 text-white";
    labelCls = "text-red-600";
  } else if (muted) {
    dotCls = "border-gray-100 bg-gray-50 text-gray-300";
    labelCls = "text-gray-300";
  } else {
    dotCls = "border-gray-200 bg-white text-gray-400";
    labelCls = "text-gray-400";
  }

  return (
    <div className="flex items-center gap-2">
      <span className={"grid h-6 w-6 place-items-center rounded-full border text-xs font-semibold transition " + dotCls}>
        {active && tone === "approved" && <Check size={12} />}
        {active && tone === "rejected" && <AlertTriangle size={12} />}
      </span>
      <span className={"whitespace-nowrap text-[11px] font-semibold " + labelCls}>{label}</span>
    </div>
  );
}
