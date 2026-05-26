// 신청 단계 상세 탭 — 용역 제작(data_production) 폼의 상세 페이지에서 ProgressBar 아래에 노출.
//
// Phase 1 (현재): 역할 분기 미적용. 로그인 사용자 누구든 전체 UI(추가/제거/다음 단계 버튼)
// 동일하게 노출. 백엔드 권한 가드 / 역할별 UI 분기는 Phase 2 에서 적용.
//
// 실무 담당자 목록은 sessionStorage 영속 로컬 state — 백엔드 미연결.
// '실무자 추가' 는 window.prompt 로 이름/이메일 입력 (사용자 검색 UI 없음).
// '협의 단계로' 버튼은 alert — 실제 단계 전환은 Phase 2.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Plus, Users, X } from "lucide-react";
import type { Me } from "@/lib/governance/api-client-full";
import { getChatAssignee } from "@/lib/governance/chat-assignee";

interface MemberMock {
  id: string;
  name: string;
  email: string;
}

interface Props {
  formId: string;
  formType: string;
  submitterEmail: string;
  submitterName: string;
  me: Me | null;
  /** 현재 5단계 인덱스 (0=신청, 1=협의, …). 부모(detail page) 가 관리. */
  currentStage: number;
  /** [협의 단계로] 등 다음 단계로 진행. 부모가 sessionStorage 영속 처리. */
  onAdvanceStage: () => void;
}

function initial(name: string): string {
  return name.trim().slice(0, 1) || "?";
}

const STORAGE_KEY = (formId: string) => `dh:gov:stage1:members:${formId}`;

export function ApplicationStageTab({
  formId,
  formType,
  submitterEmail,
  submitterName,
  me,
  currentStage,
  onAdvanceStage,
}: Props) {
  const lead = useMemo(() => getChatAssignee(), []);
  const [members, setMembers] = useState<MemberMock[]>([]);
  const meEmail = me?.user.email ?? null;
  // 현재 사용자 식별 (Phase 1 — 라벨/배지 용도. UI 가드는 미적용).
  const isLead = !!meEmail && meEmail.toLowerCase() === lead.email.toLowerCase();
  const isApplicant =
    !!meEmail && meEmail.toLowerCase() === submitterEmail.toLowerCase();
  // 다음 단계 라벨.
  const nextStageLabel =
    currentStage === 0
      ? "협의 단계로"
      : currentStage === 1
        ? "계약 단계로"
        : currentStage === 2
          ? "진행 단계로"
          : currentStage === 3
            ? "종료 단계로"
            : "완료";

  // Phase 1 — 실무 담당자 목록 sessionStorage 영속.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY(formId));
      if (raw) setMembers(JSON.parse(raw) as MemberMock[]);
    } catch {
      /* ignore */
    }
  }, [formId]);

  function persist(next: MemberMock[]) {
    setMembers(next);
    try {
      sessionStorage.setItem(STORAGE_KEY(formId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const [modalOpen, setModalOpen] = useState(false);

  function onAddMember(name: string, email: string): string | null {
    const n = name.trim();
    const e = email.trim();
    if (!n) return "이름을 입력해 주세요.";
    if (!e) return "이메일을 입력해 주세요.";
    if (members.some((m) => m.email.toLowerCase() === e.toLowerCase())) {
      return "이미 추가된 담당자입니다.";
    }
    persist([...members, { id: `mock-${Date.now()}`, name: n, email: e }]);
    return null;
  }

  function onRemoveMember(id: string) {
    persist(members.filter((m) => m.id !== id));
  }

  function onAdvance() {
    // 신청 단계에서는 실무자 1명 이상 지정 필수. 그 이후 단계는 제약 없음(Phase 1).
    if (currentStage === 0 && members.length === 0) return;
    if (currentStage >= 4) return;
    onAdvanceStage();
  }

  // 용역 제작이 아니면 본 탭 숨김. 역할 가드는 Phase 1 에선 미적용.
  if (formType !== "data_production") return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-2">
        <Users size={16} className="text-[#993C1D]" aria-hidden="true" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          담당자
        </h3>
        {currentStage === 0 && (
          <span aria-hidden="true" className="text-[12px] text-[#D4533E]">*</span>
        )}
      </header>
      <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
        {currentStage === 0
          ? "실무 담당자를 1명 이상 지정해 주세요 — 협의 단계로 진행하려면 필수입니다."
          : "현재 단계에서 담당자 변경은 자유롭게 가능합니다."}
      </p>

      {/* 담당자 칩 영역 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 총괄 (항상 표시, 제거 불가) */}
        <AssigneeChip
          name={lead.name}
          isMe={meEmail?.toLowerCase() === lead.email.toLowerCase()}
          badge="총괄"
        />

        {/* 실무 담당자들 */}
        {members.map((m) => (
          <AssigneeChip
            key={m.id}
            name={m.name}
            isMe={meEmail?.toLowerCase() === m.email.toLowerCase()}
            removable
            onRemove={() => onRemoveMember(m.id)}
          />
        ))}

        {/* 추가 버튼 */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-[11px] text-gray-500 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus size={11} aria-hidden="true" /> 실무자 추가
        </button>
      </div>

      {modalOpen && (
        <AddMemberModal
          onClose={() => setModalOpen(false)}
          onAdd={onAddMember}
        />
      )}

      {/* 다음 단계 버튼 */}
      {currentStage < 4 && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onAdvance}
            disabled={currentStage === 0 && members.length === 0}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#D4533E] px-4 py-2.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
          >
            {currentStage === 0 ? "실무자 지정 완료 · " : ""}
            {nextStageLabel}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          {currentStage === 0 && members.length === 0 && (
            <p className="mt-1.5 text-center text-[10px] text-gray-400">
              실무 담당자가 지정되면 활성화됩니다.
            </p>
          )}
        </div>
      )}

      {/* 현재 사용자 컨텍스트 (Phase 2 백엔드 권한 적용 시까지 UI 가드 미적용). */}
      <span className="hidden" aria-hidden="true">
        {submitterEmail} {submitterName} {isLead ? "lead" : ""}{" "}
        {isApplicant ? "applicant" : ""}
      </span>
    </section>
  );
}

/** 실무자 추가 모달 — 이름·이메일 입력, Enter 로 즉시 추가, Esc 로 취소.
 *  onAdd 가 에러 메시지(string) 를 반환하면 인라인 노출 후 닫지 않음.
 *  null 반환 시 추가 성공 → 모달 닫힘. */
function AddMemberModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, email: string) => string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
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

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    // 한글(IME) 조합 중 Enter 는 글자 확정 — 추가하지 않음.
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="add-member-title"
            className="text-[14px] font-medium text-gray-900 dark:text-gray-100"
          >
            실무 담당자 추가
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

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
              이름
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr(null);
              }}
              onKeyDown={onEnter}
              placeholder="실무 담당자 이름"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErr(null);
              }}
              onKeyDown={onEnter}
              placeholder="example@company.com"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          {err && (
            <p className="text-[11px] text-[#993C1D]" role="alert">
              {err}
            </p>
          )}
        </div>

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

/** 담당자 칩 — 아바타 + 이름 + (옵션) 배지 / (옵션) 제거 버튼. */
function AssigneeChip({
  name,
  isMe = false,
  badge,
  removable = false,
  onRemove,
}: {
  name: string;
  isMe?: boolean;
  badge?: string;
  removable?: boolean;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
      style={{ background: "#FAECE7", color: "#993C1D" }}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-medium text-white"
        style={{ background: "#993C1D" }}
        aria-hidden="true"
      >
        {initial(name)}
      </span>
      <span>{name}</span>
      {isMe && (
        <span className="rounded bg-white/60 px-1 text-[9px]">나</span>
      )}
      {badge && (
        <span
          className="rounded px-1 text-[9px] text-white"
          style={{ background: "#993C1D" }}
        >
          {badge}
        </span>
      )}
      {removable && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${name} 제거`}
          className="ml-0.5 opacity-60 transition hover:opacity-100"
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
