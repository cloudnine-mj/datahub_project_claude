// 신청 단계 상세 탭 — 용역 제작(data_production) 폼의 상세 페이지에서 ProgressBar 아래에 노출.
//
// Phase 1 (현재): 역할 분기 미적용. 로그인 사용자 누구든 전체 UI(추가/제거/다음 단계 버튼)
// 동일하게 노출. 백엔드 권한 가드 / 역할별 UI 분기는 Phase 2 에서 적용.
//
// 실무 담당자 목록은 sessionStorage 영속 로컬 state — 백엔드 미연결.
// '실무자 추가' 는 window.prompt 로 이름/이메일 입력 (사용자 검색 UI 없음).
// '협의 단계로' 버튼은 alert — 실제 단계 전환은 Phase 2.

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, UserPlus, Users, X } from "lucide-react";
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
}: Props) {
  const lead = useMemo(() => getChatAssignee(), []);
  const [members, setMembers] = useState<MemberMock[]>([]);
  const meEmail = me?.user.email ?? null;

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

  function onAddMember() {
    const name = window.prompt("실무 담당자 이름");
    if (!name) return;
    const email = window.prompt("실무 담당자 이메일");
    if (!email) return;
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      window.alert("이미 추가된 담당자입니다.");
      return;
    }
    persist([
      ...members,
      { id: `mock-${Date.now()}`, name: name.trim(), email: email.trim() },
    ]);
  }

  function onRemoveMember(id: string) {
    persist(members.filter((m) => m.id !== id));
  }

  function onAdvance() {
    if (members.length === 0) return;
    window.alert(
      "Phase 1 — UI 만 구현된 상태입니다. 단계 전환 / 백엔드 연동은 Phase 2.",
    );
  }

  // 용역 제작이 아니면 본 탭 숨김. 역할 가드는 Phase 1 에선 미적용.
  if (formType !== "data_production") return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-[#993C1D]" aria-hidden="true" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          실무 담당자 지정
        </h3>
        <span aria-hidden="true" className="text-[12px] text-[#D4533E]">*</span>
        <span className="ml-auto text-[10px] text-gray-400">
          Phase 1 — 모든 사용자에게 동일 UI 노출 (역할 가드 미적용)
        </span>
      </header>

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
          onClick={onAddMember}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-[11px] text-gray-500 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus size={11} aria-hidden="true" /> 실무자 추가
        </button>
      </div>

      {/* 실무자 미지정 안내 */}
      {members.length === 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#993C1D]">
          <UserPlus size={12} aria-hidden="true" />
          실무 담당자를 1명 이상 지정해 주세요 — 협의 단계로 진행하려면 필수입니다.
        </div>
      )}

      {/* 다음 단계 버튼 */}
      <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button
          type="button"
          onClick={onAdvance}
          disabled={members.length === 0}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#D4533E] px-4 py-2.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
        >
          실무자 지정 완료 · 협의 단계로
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        {members.length === 0 && (
          <p className="mt-1.5 text-center text-[10px] text-gray-400">
            실무 담당자가 지정되면 활성화됩니다.
          </p>
        )}
      </div>

      {/* submitterEmail / submitterName 은 Phase 2 알림 라우팅에 사용 예정 — 현재는 미사용. */}
      <span className="hidden" aria-hidden="true">
        {submitterEmail}
        {submitterName}
      </span>
    </section>
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
