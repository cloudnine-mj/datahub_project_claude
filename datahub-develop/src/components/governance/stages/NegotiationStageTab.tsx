// 협의 단계(2/5) 상세 탭 — 용역 제작(data_production) 폼 협의 단계 본문.
//
// 레이아웃: 2열 그리드 (좌측 카드 컬럼 + 우측 채팅, items-stretch 로 높이 정렬).
//   좌측: 지금 할 일 / 신청 정보(접힘) / 합의 결과 / 협의 자료 / [계약 단계로 진행]
//   우측: 담당자와 소통 채팅 (부모가 전달한 ChatPanel 그대로 재사용)
//
// 권한:
//   담당자(isLead || isMember) — 합의 결과 인라인 편집 + [계약 단계로 진행] 노출.
//   신청자                      — 합의 결과 읽기 전용, [계약 단계로 진행] 미렌더(자리 없음).
//
// 단계 전환은 모달의 [계약 단계로 진행 →] 에서만 발생(자동 전환 금지). 확정 시:
//   1) 합의 결과 잠금(locked=true)  2) stage_transition 이력 기록
//   3) 부모 onAdvanceToContract() → serviceStage 를 계약(2) 로 갱신
//   채팅 단계 구분선은 계약 단계 메시지 발생 시 ChatPanel 이 chat-stages 맵으로 자동 노출
//   (기존 컨벤션 — 별도 시스템 메시지 생성하지 않음).

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowRightCircle, ChevronDown, CircleCheck } from "lucide-react";
import { api, type FormDetail, type Me } from "@/lib/governance/api-client-full";
import { getChatAssignee } from "@/lib/governance/chat-assignee";
import {
  ensureWorkCountDefault,
  lockNegotiation,
  readNegotiation,
  writeNegotiation,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import { AgreementResultCard } from "./negotiation/AgreementResultCard";
import { NegotiationFilesCard } from "./negotiation/NegotiationFilesCard";
import { ProceedToContractModal } from "./negotiation/ProceedToContractModal";

const MEMBERS_KEY = (formId: string) => `dh:gov:stage1:members:${formId}`;

interface MemberMock {
  id: string;
  name: string;
  email: string;
}

interface Props {
  formId: string;
  form: FormDetail;
  me: Me | null;
  /** 신청 정보 표(헤더 제외) — 부모가 만든 표를 접힘 카드 본문으로 재사용. */
  requestInfoTable: ReactNode;
  /** 우측 채팅 패널 — 부모가 만든 ChatPanel(fillParent) 그대로. */
  chatPanel: ReactNode;
  /** 계약 단계 전환 — 부모가 serviceStage 를 계약(2) 으로 갱신. */
  onAdvanceToContract: () => void;
  /** 이력 변경 후 부모가 폼을 다시 불러오도록 알림(타임라인 갱신). */
  onActivity?: () => void;
}

export function NegotiationStageTab({
  formId,
  form,
  me,
  requestInfoTable,
  chatPanel,
  onAdvanceToContract,
  onActivity,
}: Props) {
  const lead = useMemo(() => getChatAssignee(), []);
  const [negotiation, setNegotiation] = useState<NegotiationResult>(() =>
    readNegotiation(formId),
  );
  const [modalOpen, setModalOpen] = useState(false);

  const meEmail = me?.user.email?.toLowerCase() ?? null;

  // 담당자 판별 — 총괄(고정) + 멤버 키. 신청자는 읽기 전용.
  const isAssignee = useMemo(() => {
    if (!meEmail) return false;
    if (meEmail === lead.email.toLowerCase()) return true;
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem(MEMBERS_KEY(formId));
      const members = raw ? (JSON.parse(raw) as MemberMock[]) : [];
      return members.some((m) => m.email.toLowerCase() === meEmail);
    } catch {
      return false;
    }
  }, [meEmail, lead.email, formId]);

  // 작업 건수 초기값 — 신청서 '목표 데이터 수량' 으로 1회 자동 채움(미입력 시에만).
  useEffect(() => {
    const raw = form.payload?.["목표_데이터_수량"];
    const def = raw === undefined || raw === null ? "" : String(raw);
    ensureWorkCountDefault(formId, def);
    setNegotiation(readNegotiation(formId));
  }, [formId, form]);

  const locked = negotiation.locked;
  const canEdit = isAssignee && !locked;

  function onField(key: NegotiationField, next: string): void {
    if (!canEdit) return;
    setNegotiation(writeNegotiation(formId, { [key]: next }));
  }

  // [계약 단계로 진행 →] 확정 — 잠금 + 이력 기록 + 단계 갱신.
  function onProceedToContract(): void {
    const lockedResult = lockNegotiation(formId);
    setNegotiation(lockedResult);
    api
      .appendFormEvent(formId, {
        action: "stage_transition",
        comment: "협의 → 계약",
        actorName: lead.name,
        actorRole: "lead",
      })
      .then(() => onActivity?.())
      .catch(() => {
        /* ignore */
      });
    onAdvanceToContract();
    setModalOpen(false);
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-3">
        <TodoCard />

        <CollapsibleRequestInfo>{requestInfoTable}</CollapsibleRequestInfo>

        <AgreementResultCard
          value={negotiation}
          canEdit={canEdit}
          locked={locked}
          onField={onField}
        />

        <NegotiationFilesCard formId={formId} />

        {/* 담당자에게만 렌더 — 신청자에게는 null(자리 차지 안 함). */}
        {isAssignee && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={locked}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#D4533E] px-4 py-[11px] text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
          >
            계약 단계로 진행
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
        {isAssignee && (
          <p className="text-center text-[11px] text-gray-400">
            담당자에게만 노출 · 신청자에게는 미렌더
          </p>
        )}
      </div>

      <div className="min-h-0">{chatPanel}</div>

      {modalOpen && (
        <ProceedToContractModal
          value={negotiation}
          onField={onField}
          onProceed={onProceedToContract}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

/** 지금 할 일 카드 — 신청자/담당자 동일 문구. */
function TodoCard() {
  return (
    <section
      className="flex items-start gap-2.5 rounded-xl p-4"
      style={{ background: "#FCF3F0", border: "0.5px solid #EFC4B9" }}
    >
      <ArrowRightCircle
        size={18}
        aria-hidden="true"
        className="mt-px shrink-0 text-[#D4533E]"
      />
      <div>
        <h3 className="mb-0.5 text-[13px] font-medium text-[#993C1D]">지금 할 일</h3>
        <p className="text-[12px] leading-relaxed text-[#993C1D]/85">
          채팅으로 작업 내용·업체·견적을 논의하세요. 합의가 끝나면 담당자가 합의 결과를 정리하고 [계약 단계로 진행]을 눌러 다음 단계로 넘어갑니다.
        </p>
      </div>
    </section>
  );
}

/** 신청 정보 카드 — 접힘 가능. 기본 접힘, 펼치면 신청서 표 노출. */
function CollapsibleRequestInfo({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]"
        />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          신청 정보
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "#E1F5EE", color: "#0F6E56" }}
        >
          <CircleCheck size={11} aria-hidden="true" /> 승인 완료
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {open ? "접기" : "펼쳐 보기"}
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </header>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}
