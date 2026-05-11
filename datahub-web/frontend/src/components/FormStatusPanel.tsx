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
import { AlertTriangle, Check, MessageSquare, Play, X } from "lucide-react";
import { api, type ApprovalEntry, type FormStatus, type Me } from "@/lib/api";
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
  { to: "rejected", label: "반려", cls: "bg-red-500 hover:bg-red-600", icon: X },
];

export function FormStatusPanel({ formId, status, history, me, submitterEmail, onChanged }: Props) {
  const isAdmin = me?.user.role === "admin";
  const isOwnSubmission = !!me && !!submitterEmail && me.user.email === submitterEmail;
  const canActAsAdmin = isAdmin && !isOwnSubmission;
  const [target, setTarget] = useState<FormStatus | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {/* 타임라인 */}
      {history && history.length > 0 ? (
        <ol className="mt-4 space-y-3 border-l-2 border-gray-100 pl-5">
          {history.map((h, i) => (
            <li key={i} className="relative">
              <span
                className={
                  "absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white " +
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
      ) : (
        <p className="mt-3 text-xs text-gray-400">
          승인 이력이 없습니다 — 제출 후 거버넌스 관리자의 검토를 기다리고 있습니다.
        </p>
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
    const d = new Date(iso);
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
 * 워크플로우 stepper — 4단계 + 반려 분기.
 *   임시저장 → 제출됨 → 검토 중 → 승인 완료
 *   (반려 상태면 마지막 단계가 빨간색 '반려' 로 교체)
 */
function WorkflowStepper({ status }: { status: FormStatus | string }) {
  const isRejected = status === "rejected";
  const steps = [
    { key: "draft", label: "임시저장" },
    { key: "submitted", label: "제출됨" },
    { key: "reviewing", label: "검토 중" },
    isRejected
      ? { key: "rejected", label: "반려" }
      : { key: "approved", label: "승인 완료" },
  ];

  const order: Record<string, number> = {
    draft: 0,
    submitted: 1,
    reviewing: 2,
    approved: 3,
    rejected: 3,
  };
  const currentIdx = order[status as string] ?? 0;

  return (
    <ol className="mt-4 flex w-full items-center">
      {steps.map((s, i) => {
        const reached = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const stepRejected = isRejected && i === 3;
        return (
          <li
            key={s.key}
            className={"flex items-center " + (i < steps.length - 1 ? "flex-1" : "")}
          >
            <div className="flex flex-col items-center">
              <span
                className={
                  "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition " +
                  (stepRejected
                    ? "border-red-500 bg-red-500 text-white"
                    : reached
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-200 bg-white text-gray-400")
                }
              >
                {stepRejected ? (
                  <AlertTriangle size={13} />
                ) : reached && !isCurrent ? (
                  <Check size={13} />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={
                  "mt-1.5 whitespace-nowrap text-[11px] font-semibold " +
                  (stepRejected
                    ? "text-red-600"
                    : isCurrent
                    ? "text-blue-700"
                    : reached
                    ? "text-gray-700"
                    : "text-gray-400")
                }
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={
                  "mx-2 mt-[-18px] h-0.5 flex-1 " +
                  (i < currentIdx ? "bg-blue-500" : "bg-gray-200")
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
