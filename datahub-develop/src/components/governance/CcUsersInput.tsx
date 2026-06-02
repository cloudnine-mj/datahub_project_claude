// 참조자(CC users) 입력 — 담당자 지정과 동일한 모달(이름+이메일 팝업) 방식.
//   inline: 신청서 폼 행 — 칩 목록 + [+ 참조자 추가] 점선 버튼 → 모달.
//   card:   협의 단계 카드 — 동일 동작(헤더 뱃지는 카드 래퍼가 담당).
//
// 추가는 모달에서 이름·이메일 입력(Enter 즉시 추가, Esc 취소). 이메일 기준 중복 금지.
// Phase 1: 권한 분기 없음. 안내 문구 없음.

"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { addCcUser, removeCcUser, type CcUser } from "@/lib/governance/cc-users-storage";
import { UserPicker } from "@/components/governance/UserPicker";

interface Props {
  value: CcUser[];
  onChange: (next: CcUser[]) => void;
  mode: "inline" | "card";
}

export function CcUsersInput({ value, onChange }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((u) => (
          <CcChip
            key={u.email}
            user={u}
            onRemove={() => onChange(removeCcUser(value, u.email))}
          />
        ))}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-[14px] border-[0.5px] border-dashed border-[var(--color-border-secondary,#d1d5db)] px-[9px] py-[3px] text-[11px] text-gray-500 transition hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus size={11} aria-hidden="true" /> 참조자 추가
        </button>
      </div>

      {modalOpen && (
        <AddCcUserModal
          onClose={() => setModalOpen(false)}
          onAdd={(name, email) => {
            const res = addCcUser(value, name, email);
            if (res.error) return res.error;
            onChange(res.list);
            return null;
          }}
        />
      )}
    </div>
  );
}

/** 파란 참조자 칩 — 이름(+이메일 title) + X 제거. */
function CcChip({ user, onRemove }: { user: CcUser; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px]"
      style={{
        background: "#E6F1FB",
        color: "#0C447C",
        borderRadius: 14,
        padding: "3px 6px 3px 10px",
      }}
      title={user.email || undefined}
    >
      {user.name}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${user.name} 제거`}
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-white transition hover:brightness-110"
        style={{ background: "#0C447C" }}
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
  );
}

/** 참조자 추가 모달 — 담당자 추가 모달과 동일 패턴(이름·이메일, Enter 추가, Esc 취소).
 *  onAdd 가 에러 메시지를 반환하면 인라인 노출 후 닫지 않음. null 이면 성공 → 닫힘. */
function AddCcUserModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, email: string) => string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    const error = onAdd(name, email);
    if (error) {
      setErr(error);
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-cc-user-title"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="add-cc-user-title"
            className="text-[14px] font-medium text-gray-900 dark:text-gray-100"
          >
            참조자 추가
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <UserPicker
          name={name}
          email={email}
          onChange={(next) => {
            setName(next.name);
            setEmail(next.email);
            setErr(null);
          }}
          onSubmit={submit}
        />
        {err && (
          <p className="mt-3 text-[11px] text-[#993C1D]" role="alert">
            {err}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-md bg-[#D4533E] px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:brightness-110"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
