// 거버넌스 요청 상세 — 담당자 처리 카드.
//   역할(potential-assignee / assignee / applicant / observer) 에 따라 편집 가능 영역 분기.
//   데모: 변경 사항은 로컬 state 에만 보존 (실제 저장 API 미연결).

"use client";

import { useState, type KeyboardEvent } from "react";
import { ClipboardCheck, Edit3, Lock, Save, X } from "lucide-react";
import type { UserRoleForRequest } from "@/lib/requestRole";
import {
  canEditAssignment,
  canEditNote,
  canEditStatus,
  showAssigneeActions,
} from "@/lib/requestRole";

export type ProcessingStatus =
  | "pending"
  | "negotiating"
  | "contracting"
  | "completed";

const STATUS_LABEL: Record<ProcessingStatus, string> = {
  pending: "담당자 지정 대기",
  negotiating: "업체 협의 중",
  contracting: "계약 진행 중",
  completed: "처리 완료",
};

const STATUS_OPTIONS: ProcessingStatus[] = [
  "pending",
  "negotiating",
  "contracting",
  "completed",
];

interface Props {
  role: UserRoleForRequest;
  /** 최초 표시용 — 신청서 participants 등에서 복원 가능. */
  initialAssignees?: string[];
  initialNote?: string;
  initialStatus?: ProcessingStatus;
  /** 신청자 명 — readonly 모드에서 'X가 진행 중' 안내에 사용. */
  primaryAssigneeName?: string;
}

function initials(name: string): string {
  return name.trim().slice(0, 2) || "?";
}

export function AssigneeProcessingCard({
  role,
  initialAssignees = [],
  initialNote = "",
  initialStatus = "pending",
  primaryAssigneeName,
}: Props) {
  const [assignees, setAssignees] = useState<string[]>(initialAssignees);
  const [note, setNote] = useState(initialNote);
  const [status, setStatus] = useState<ProcessingStatus>(initialStatus);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  if (role === "applicant" || role === "observer") {
    return (
      <ReadonlyCard
        assignees={assignees}
        status={status}
        primaryAssigneeName={primaryAssigneeName}
        role={role}
      />
    );
  }

  const editAssign = canEditAssignment(role);
  const editNote = canEditNote(role);
  const editStatus = canEditStatus(role);

  const addAssignee = () => {
    const v = input.trim();
    if (!v) return;
    if (assignees.includes(v)) {
      setInput("");
      return;
    }
    setAssignees([...assignees, v]);
    setInput("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      addAssignee();
    }
  };

  const save = () => {
    // 데모: 실제 저장은 미연결. 토스트만 표시.
    setToast("처리 정보가 저장되었습니다.");
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <section className="rounded-xl border border-brand bg-white px-5 py-4 shadow-[0_0_0_2px_rgba(212,83,62,0.06)] dark:border-red-900/40 dark:bg-gray-900">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2.5 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <ClipboardCheck size={14} aria-hidden="true" className="text-brand" />
          <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            담당자 처리 영역
          </h2>
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
            본인 영역
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-red-700 dark:text-red-300">
          <Edit3 size={12} aria-hidden="true" />
          편집 가능
        </span>
      </header>

      {/* 담당자 지정 */}
      <FieldRow
        label="담당자 지정"
        required
        labelHint={
          !editAssign ? "담당자 추가·제거는 박용민에게 요청하세요." : undefined
        }
      >
        {assignees.length > 0 && (
          <ul className="mb-1.5 flex flex-wrap gap-1.5">
            {assignees.map((a) => (
              <li
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-1.5 pr-2 text-[11px] dark:bg-gray-800"
              >
                <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                  {initials(a)}
                </span>
                <span className="text-gray-800 dark:text-gray-200">{a}</span>
                {editAssign && (
                  <button
                    type="button"
                    aria-label={`${a} 제거`}
                    onClick={() =>
                      setAssignees(assignees.filter((x) => x !== a))
                    }
                    className="ml-0.5 rounded p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  >
                    <X size={10} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editAssign && (
          <>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              onBlur={addAssignee}
              placeholder="담당자 이름 입력 후 Enter"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
            />
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
              지정된 담당자에게 알림이 발송됩니다.
            </p>
          </>
        )}
      </FieldRow>

      {/* 협의 메모 */}
      <FieldRow label="협의 메모">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!editNote}
          placeholder="업체 협의 노트·일정·연락처 등을 작성하세요 (선택)"
          className="min-h-[60px] w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:disabled:bg-gray-800/60"
        />
      </FieldRow>

      {/* 처리 상태 */}
      <FieldRow label="처리 상태" required>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProcessingStatus)}
          disabled={!editStatus}
          className="w-[240px] rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:disabled:bg-gray-800/60"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </FieldRow>

      {/* 액션 */}
      {showAssigneeActions(role) && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-4 py-1.5 text-[12px] font-medium text-blue-700 transition hover:brightness-95 dark:bg-blue-900/30 dark:text-blue-300"
          >
            <Save size={13} aria-hidden="true" />
            처리 정보 저장
          </button>
        </div>
      )}

      {toast && (
        <div
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </section>
  );
}

function ReadonlyCard({
  assignees,
  status,
  primaryAssigneeName,
  role,
}: {
  assignees: string[];
  status: ProcessingStatus;
  primaryAssigneeName?: string;
  role: "applicant" | "observer";
}) {
  return (
    <section className="rounded-xl bg-gray-50/70 px-5 py-4 dark:bg-gray-800/40">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ClipboardCheck
            size={13}
            aria-hidden="true"
            className="text-gray-500 dark:text-gray-400"
          />
          <h2 className="text-[12px] font-medium text-gray-600 dark:text-gray-300">
            담당자 처리 영역
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
          <Lock size={11} aria-hidden="true" />
          {role === "applicant"
            ? `${primaryAssigneeName || "담당자"}가 진행 중`
            : "읽기 전용"}
        </span>
      </header>
      <dl
        className="grid gap-y-1.5 gap-x-3 text-[11px]"
        style={{ gridTemplateColumns: "120px 1fr" }}
      >
        <dt className="text-gray-400 dark:text-gray-500">담당자</dt>
        <dd className="text-gray-700 dark:text-gray-200">
          {assignees.length > 0 ? assignees.join(", ") : "미지정"}
        </dd>
        <dt className="text-gray-400 dark:text-gray-500">처리 상태</dt>
        <dd className="text-gray-700 dark:text-gray-200">{STATUS_LABEL[status]}</dd>
      </dl>
    </section>
  );
}

function FieldRow({
  label,
  required,
  labelHint,
  children,
}: {
  label: string;
  required?: boolean;
  labelHint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-3.5 grid items-start gap-x-3.5 gap-y-1 text-[12px]"
      style={{ gridTemplateColumns: "140px 1fr" }}
    >
      <label className="pt-2 text-gray-500 dark:text-gray-400">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
        {labelHint && (
          <span className="block pt-1 text-[10px] text-gray-400 dark:text-gray-500">
            {labelHint}
          </span>
        )}
      </label>
      <div>{children}</div>
    </div>
  );
}
