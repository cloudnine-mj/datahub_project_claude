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
import { Check, Play } from "lucide-react";
import { api, type FormStatus, type Me } from "@/lib/api";

interface Props {
  formId: number;
  status: FormStatus | string;
  me: Me | null;
  /** 신청 제출자 이메일 — admin 이라도 본인 신청에는 액션 숨김 (자기 결재 방지) */
  submitterEmail?: string | null;
  onChanged: () => void;
}

const TRANSITIONS: { to: FormStatus; label: string; cls: string; icon: typeof Play }[] = [
  { to: "reviewing", label: "검토 시작", cls: "bg-amber-500 hover:bg-amber-600", icon: Play },
  { to: "approved", label: "승인", cls: "bg-emerald-500 hover:bg-emerald-600", icon: Check },
];

export function FormStatusPanel({ formId, status, me, submitterEmail, onChanged }: Props) {
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

  // 진행 상태 / 진행 이력 시각화는 chevron 진행 바의 '승인 완료' 패널에서 노출.
  // 이 컴포넌트는 admin 의 상태 변경 액션만 책임.
  if (!canActAsAdmin) return null;

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
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
    </section>
  );
}

