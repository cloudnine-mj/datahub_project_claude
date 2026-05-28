// 신청 단계 상세 탭 — 용역 제작(data_production) 폼의 상세 페이지에서 ProgressBar 아래에 노출.
//
// 신청 단계 내부 세부 흐름 (currentStage === 0 일 때):
//   member_assignment   — 담당자 지정 중 (총괄이 실무자 지정)
//      ↓ [검토 요청]
//   under_review        — 담당자 검토 중
//      ├ [보완 요청]    → revision_requested
//      └ [승인]          → approved + serviceStage 0→1 (협의로 advance)
//
//   revision_requested  — 보완 요청됨
//      ↓ [검토 재시작]  (담당자) 또는 신청자 보완 후 재제출
//   다시 under_review
//
//   approved            — 승인 완료 (이 시점에 serviceStage 가 이미 1+)
//
// Phase 1:
//   - 실무 담당자 / sub-step 모두 sessionStorage 영속 (백엔드 컬럼 없음).
//   - sub-step 은 부모(detail page) 가 lift 해서 ProgressBar / 본 탭이 공유.
//   - 검토 버튼은 담당자(총괄/실무) 에게만 노출 — 신청자는 대기/보완 안내.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Plus, RefreshCw, Users, X } from "lucide-react";
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
  /** [협의 단계로] 등 다음 단계로 진행. 부모가 sessionStorage 영속 처리. */
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
  submitterEmail,
  submitterName,
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
  const meEmail = me?.user.email ?? null;

  // 역할 식별 — Phase 1 검토 버튼 가시성에 사용. 담당자 섹션 자체는
  // 모든 진입/모든 사용자에게 노출되며 추가·제거도 자유롭게 허용한다.
  const isLead = !!meEmail && meEmail.toLowerCase() === lead.email.toLowerCase();
  const isMember =
    !!meEmail &&
    members.some((m) => m.email.toLowerCase() === meEmail.toLowerCase());
  const isApplicant =
    !!meEmail && meEmail.toLowerCase() === submitterEmail.toLowerCase();
  const isAssignee = isLead || isMember;

  // Phase 1 — 실무 담당자 sessionStorage 영속.
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
  // 백엔드 실패는 조용히 무시 (Phase 1 mock 흐름 — UI 진행은 sessionStorage 가 책임).
  function logEvent(action: string, comment?: string): void {
    api
      .appendFormEvent(formId, { action, comment })
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
    logEvent("assigned", `실무 담당자 지정: ${n}`);
    return null;
  }

  function onRemoveMember(id: string): void {
    persistMembers(members.filter((m) => m.id !== id));
  }

  // 신청 단계 액션 — 모두 sub-step 콜백을 통해 부모에 전달.
  // Phase 1 개발 편의: members 0 가드 제거 — 자유 이동 허용.
  function onRequestReview(): void {
    onSubStepChange("under_review");
    logEvent("review_started", "검토 요청");
  }

  function onRequestRevision(): void {
    onSubStepChange("revision_requested");
    logEvent("info_requested", "보완 요청");
  }

  function onApproveAndAdvance(): void {
    onSubStepChange("approved");
    onAdvanceStage();
    logEvent("approved", "승인 완료");
  }

  function onResumeReview(): void {
    onSubStepChange("under_review");
  }

  function onAdvanceGeneric(): void {
    if (currentStage >= 4) return;
    onAdvanceStage();
  }

  if (formType !== "data_production") return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-2">
        <Users size={16} className="text-[#993C1D]" aria-hidden="true" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          담당자
        </h3>
        {currentStage === 0 && subStep === "member_assignment" && (
          <span aria-hidden="true" className="text-[12px] text-[#D4533E]">*</span>
        )}
        {subStep === "revision_requested" && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#FBEBD6", color: "#B5610F" }}
          >
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "#E08027" }}
            />
            보완 요청됨
          </span>
        )}
      </header>
      <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">
        {currentStage === 0 && subStep === "member_assignment"
          ? "실무 담당자를 1명 이상 지정해 주세요 — 검토 요청을 보내려면 필수입니다."
          : "현재 단계에서 담당자 변경은 자유롭게 가능합니다."}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <AssigneeChip
          name={lead.name}
          isMe={meEmail?.toLowerCase() === lead.email.toLowerCase()}
          badge="총괄"
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
          <Plus size={11} aria-hidden="true" /> 실무자 추가
        </button>
      </div>

      {modalOpen && (
        <AddMemberModal
          onClose={() => setModalOpen(false)}
          onAdd={onAddMember}
        />
      )}

      <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
        {currentStage === 0 ? (
          <Stage0Actions
            subStep={subStep}
            // Phase 1 — 가드 모두 해제: members 0 허용, 역할별 분기 무시.
            membersAssigned
            isAssignee
            isApplicant={isApplicant}
            onRequestReview={onRequestReview}
            onRequestRevision={onRequestRevision}
            onApprove={onApproveAndAdvance}
            onResumeReview={onResumeReview}
          />
        ) : currentStage < 4 ? (
          <GenericAdvanceButton
            stageIndex={currentStage}
            onAdvance={onAdvanceGeneric}
          />
        ) : (
          <p className="text-center text-[11px] text-gray-400">
            모든 단계가 완료되었습니다.
          </p>
        )}
      </div>

      <span className="hidden" aria-hidden="true">
        {submitterName} {isLead ? "lead" : ""} {isMember ? "member" : ""}{" "}
        {isApplicant ? "applicant" : ""}
      </span>
    </section>
  );
}

/** 신청 단계 내부 액션 — sub-step + 역할별 분기. */
function Stage0Actions({
  subStep,
  membersAssigned,
  isAssignee,
  isApplicant,
  onRequestReview,
  onRequestRevision,
  onApprove,
  onResumeReview,
}: {
  subStep: SubStep;
  membersAssigned: boolean;
  isAssignee: boolean;
  isApplicant: boolean;
  onRequestReview: () => void;
  onRequestRevision: () => void;
  onApprove: () => void;
  onResumeReview: () => void;
}) {
  if (subStep === "member_assignment") {
    return (
      <>
        <button
          type="button"
          onClick={onRequestReview}
          disabled={!membersAssigned}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#D4533E] px-4 py-2.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
        >
          실무자 지정 완료 · 검토 요청
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        {!membersAssigned && (
          <p className="mt-1.5 text-center text-[10px] text-gray-400">
            실무 담당자가 지정되면 활성화됩니다.
          </p>
        )}
      </>
    );
  }

  if (subStep === "under_review") {
    // 담당자 시점 — 보완 요청 / 승인 버튼.
    if (isAssignee) {
      return (
        <div>
          <p className="mb-2 text-[12px] font-medium text-gray-900 dark:text-gray-100">
            신청서 검토
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRequestRevision}
              className="flex-1 rounded-md border border-[#FBEBD6] bg-[#FEF8F0] px-3 py-2 text-[12px] font-medium text-[#B5610F] transition hover:brightness-95"
            >
              보완 요청
            </button>
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#D4533E] px-3 py-2 text-[12px] font-medium text-white transition hover:brightness-110"
            >
              승인 · 협의 단계로
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      );
    }
    // 신청자/그 외 — 대기 안내.
    return (
      <p className="text-center text-[11px] text-gray-500 dark:text-gray-400">
        {isApplicant
          ? "담당자가 신청서를 검토 중입니다. 결과를 기다려 주세요."
          : "담당자 검토 중입니다."}
      </p>
    );
  }

  if (subStep === "revision_requested") {
    if (isAssignee) {
      return (
        <div>
          <p className="mb-2 text-[12px] text-[#B5610F]">
            신청자가 보완 자료 재제출을 진행 중입니다.
          </p>
          <button
            type="button"
            onClick={onResumeReview}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw size={12} aria-hidden="true" />
            검토 재시작
          </button>
        </div>
      );
    }
    return (
      <div
        className="rounded-md px-3 py-2.5 text-[11px]"
        style={{ background: "#FBEBD6", color: "#B5610F" }}
      >
        담당자가 보완을 요청했습니다. 신청서를 수정 후 재제출해 주세요.
      </div>
    );
  }

  // approved — 사실상 currentStage 가 이미 1+ 라 본 분기 진입은 드뭄.
  return (
    <p className="inline-flex items-center justify-center gap-1.5 text-center text-[11px] text-[#1D9E75]">
      <Check size={12} aria-hidden="true" />
      신청 단계 승인 완료
    </p>
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
    stageIndex === 1
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
