// 신청 단계 상세 탭 — 용역 제작(data_production) 폼 상세 페이지의 담당자 지정 카드.
//
// 신청 단계(currentStage === 0) 내부 상태머신:
//   member_assignment   — 담당자 지정 전
//      ↓ [담당자 지정 완료] (담당자)
//   under_review        — 담당자 지정됨, 채팅 논의
//      ↓ [승인 요청] (신청자, 상단 버튼 행 — 상세 페이지)
//   approval_requested  — 신청자가 승인 요청함 → [승인 완료] 활성
//      ↓ [승인 완료] (담당자)
//   approved            — 승인 완료 + 5단계 협의(1)로 전환
//
// Phase 1: 담당자 / sub-step 모두 sessionStorage 영속. 5단계 전환은 [승인 완료] 에서만 발생.
// 버튼은 역할로 숨기지 않고(목업 기준) 상태머신으로 활성/비활성만 제어.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CircleCheck, Clock, Plus, Users, X } from "lucide-react";
import { api, type Me } from "@/lib/governance/api-client-full";
import { getChatAssignee } from "@/lib/governance/chat-assignee";
import type { SubStep } from "@/components/governance/ProgressBar";

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
  /** 신청 단계 내부 sub-step — 부모(detail page) 가 lift. */
  subStep: SubStep;
  /** sub-step 변경 알림. 부모가 sessionStorage 영속 + 상위 ProgressBar 동기화. */
  onSubStepChange: (next: SubStep) => void;
  /** 다음 단계로 진행. 부모가 sessionStorage 영속 처리. [승인 완료] 시 협의(1)로 전환. */
  onAdvanceStage: () => void;
  /** 진행 이력에 영향을 주는 액션 후 부모가 폼을 다시 불러오도록 알림 (타임라인 갱신). */
  onActivity?: () => void;
}

function initial(name: string): string {
  return name.trim().slice(0, 1) || "?";
}

const MEMBERS_KEY = (formId: string) => `dh:gov:stage1:members:${formId}`;

export function ApplicationStageTab({
  formId,
  formType,
  me,
  currentStage,
  subStep,
  onSubStepChange,
  onAdvanceStage,
  onActivity,
}: Props) {
  const lead = useMemo(() => getChatAssignee(), []);
  const [members, setMembers] = useState<MemberMock[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  // [승인 완료] 확인 모달.
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const meEmail = me?.user.email ?? null;

  // Phase 1 — 담당자 sessionStorage 영속.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(MEMBERS_KEY(formId));
      if (raw) setMembers(JSON.parse(raw) as MemberMock[]);
    } catch {
      /* ignore */
    }
  }, [formId]);

  function persistMembers(next: MemberMock[]): void {
    setMembers(next);
    try {
      sessionStorage.setItem(MEMBERS_KEY(formId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // 진행 이력(approval_history) 에 이벤트 1건 기록 후 부모에 갱신 알림.
  // actorName/actorRole 로 주체(총괄/신청자) 표시명을 명시 — 타임라인 작성자 표기에 사용.
  function logEvent(
    action: string,
    comment: string,
    actorName: string,
    actorRole: string,
  ): void {
    api
      .appendFormEvent(formId, { action, comment, actorName, actorRole })
      .then(() => onActivity?.())
      .catch(() => {
        /* ignore */
      });
  }

  function onAddMember(name: string, email: string): string | null {
    const n = name.trim();
    const e = email.trim();
    if (!n) return "이름을 입력해 주세요.";
    if (!e) return "이메일을 입력해 주세요.";
    if (members.some((m) => m.email.toLowerCase() === e.toLowerCase())) {
      return "이미 추가된 담당자입니다.";
    }
    persistMembers([
      ...members,
      { id: `mock-${Date.now()}`, name: n, email: e },
    ]);
    return null;
  }

  function onRemoveMember(id: string): void {
    persistMembers(members.filter((m) => m.id !== id));
  }

  // [담당자 지정 완료] — member_assignment → under_review + 담당자 지정 이벤트 기록.
  // 이미 지정 완료 이후(under_review/approval_requested) 재클릭은 no-op (상태 역행/중복 방지).
  function onAssignComplete(): void {
    if (subStep !== "member_assignment") return;
    onSubStepChange("under_review");
    logEvent("member_assigned", "담당자 지정", lead.name, "lead");
  }

  // [승인 완료] 확인 모달 — '협의 단계로' 클릭 시 승인 확정 + 협의(1)로 즉시 이동.
  function confirmApprove(): void {
    onSubStepChange("approved");
    onAdvanceStage();
    logEvent("approved", "승인 완료", lead.name, "lead");
    setApproveModalOpen(false);
  }

  function onAdvanceGeneric(): void {
    if (currentStage >= 4) return;
    onAdvanceStage();
  }

  if (formType !== "data_production") return null;

  const isAwaitingApproval = subStep === "approval_requested";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-2">
        <Users size={16} className="text-[#993C1D]" aria-hidden="true" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          담당자 지정
        </h3>
        {currentStage === 0 && subStep === "member_assignment" && (
          <span aria-hidden="true" className="text-[12px] text-[#D4533E]">*</span>
        )}
        {currentStage === 0 && isAwaitingApproval && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#FAEEDA", color: "#854F0B" }}
          >
            <Clock size={11} aria-hidden="true" /> 승인 요청됨
          </span>
        )}
      </header>
      <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
        {currentStage === 0 && subStep === "member_assignment"
          ? "담당자를 1명 이상 지정해 주세요."
          : "현재 단계에서 담당자 변경은 자유롭게 가능합니다."}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <AssigneeChip
          name={lead.name}
          isMe={meEmail?.toLowerCase() === lead.email.toLowerCase()}
        />
        {members.map((m) => (
          <AssigneeChip
            key={m.id}
            name={m.name}
            isMe={meEmail?.toLowerCase() === m.email.toLowerCase()}
            removable
            onRemove={() => onRemoveMember(m.id)}
          />
        ))}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-[11px] text-gray-500 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus size={11} aria-hidden="true" /> 담당자 추가
        </button>
      </div>

      {modalOpen && (
        <AddMemberModal onClose={() => setModalOpen(false)} onAdd={onAddMember} />
      )}

      <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
        {currentStage === 0 ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAssignComplete}
              className="flex-1 rounded-md bg-[#D4533E] px-3 py-2.5 text-[12px] font-medium text-white transition hover:brightness-110"
            >
              담당자 지정 완료
            </button>
            <button
              type="button"
              onClick={() => setApproveModalOpen(true)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1D9E75] px-3 py-2.5 text-[12px] font-medium text-white transition hover:brightness-110"
            >
              <CircleCheck size={14} aria-hidden="true" /> 승인 완료
            </button>
          </div>
        ) : currentStage < 4 ? (
          <GenericAdvanceButton stageIndex={currentStage} onAdvance={onAdvanceGeneric} />
        ) : (
          <p className="text-center text-[11px] text-gray-400">
            모든 단계가 완료되었습니다.
          </p>
        )}
      </div>

      {/* 승인 완료 확인 모달 — '협의 단계로' 확인 시 승인 확정 + 협의(1)로 즉시 이동. */}
      {approveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setApproveModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-modal-title"
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-full"
                style={{ background: "#E1F5EE", color: "#0F6E56" }}
                aria-hidden="true"
              >
                <CircleCheck size={16} />
              </span>
              <h3
                id="approve-modal-title"
                className="text-[14px] font-medium text-gray-900 dark:text-gray-100"
              >
                승인 완료
              </h3>
            </div>
            <p className="mb-5 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
              신청 단계 승인이 완료되었습니다. 협의 단계로 넘어갑니다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApproveModalOpen(false)}
                className="rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={confirmApprove}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#1D9E75] px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:brightness-110"
              >
                협의 단계로
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** 협의 이후 단계용 — 단순 [다음 단계로] 버튼. */
function GenericAdvanceButton({
  stageIndex,
  onAdvance,
}: {
  stageIndex: number;
  onAdvance: () => void;
}) {
  const label =
    stageIndex === 0
      ? "협의 단계로"
      : stageIndex === 1
        ? "계약 단계로"
        : stageIndex === 2
          ? "진행 단계로"
          : stageIndex === 3
            ? "종료 단계로"
            : "완료";
  return (
    <button
      type="button"
      onClick={onAdvance}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#D4533E] px-4 py-2.5 text-[12px] font-medium text-white transition hover:brightness-110"
    >
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </button>
  );
}

/** 담당자 추가 모달 — 이름·이메일 입력, Enter 로 즉시 추가, Esc 로 취소.
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
            담당자 추가
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
              placeholder="담당자 이름"
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

/** 담당자 칩 — 아바타 + 이름 + (옵션) 나 표시 / (옵션) 제거 버튼. */
function AssigneeChip({
  name,
  isMe = false,
  removable = false,
  onRemove,
}: {
  name: string;
  isMe?: boolean;
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
      {isMe && <span className="rounded bg-white/60 px-1 text-[9px]">나</span>}
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
