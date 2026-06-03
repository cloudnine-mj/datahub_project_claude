// 진행 단계(3/4) 상세 탭 — 용역 제작(data_production) 본문.
//
// v3 최종(단순화): 데이터는 Datahub에 적재하지 않고 메일·SharePoint로 주고받는다.
//   Datahub는 신청자 피드백 누적·관리에만 집중.
//
// 레이아웃(위→아래):
//   1) 안내 카드  2) 신청 정보(접힘)  3) 최종 협의·계약(접힘)
//   4) 피드백 이력 카드(전체 폭, 핵심)  5) 채팅 패널(전체 폭, 사람 대화만)
//   6) [종료 단계로] 버튼(전체 폭)
//
// Phase 1: sessionStorage 기반. 권한 분기 없음. 채팅 시스템 자동 메시지 없음.

"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, CircleCheck, InfoIcon, Lock } from "lucide-react";
import type { FormDetail } from "@/lib/governance/api-client-full";
import { appendFeedback, type DeliveryRound, type FeedbackAttachmentMeta } from "@/lib/governance/feedback-storage";
import { getChatAssignee } from "@/lib/governance/chat-assignee";
import { FeedbackHistoryCard } from "./progress/FeedbackHistoryCard";
import { FeedbackComposeModal } from "./progress/FeedbackComposeModal";

interface Props {
  formId: string;
  form: FormDetail;
  /** 신청 정보 표(헤더 제외) — 부모가 만든 표를 접힘 카드 본문으로 재사용. */
  requestInfoTable: ReactNode;
  /** 채팅 패널 — 전체 폭. */
  chatPanel: ReactNode;
  /** 이력 변경 후 부모가 폼을 다시 불러오도록 알림. */
  onActivity?: () => void;
}

export function ProgressStageTab({
  formId,
  requestInfoTable,
  chatPanel,
  onActivity,
}: Props) {
  const lead = getChatAssignee();
  const [composeOpen, setComposeOpen] = useState(false);

  function onSubmitFeedback(payload: {
    deliveryRound: DeliveryRound;
    receivedDate: string;
    content: string;
    attachments: FeedbackAttachmentMeta[];
  }): void {
    // 피드백만 누적 저장. 채팅 시스템 메시지 생성하지 않음.
    appendFeedback(formId, {
      deliveryRound: payload.deliveryRound,
      receivedDate: payload.receivedDate,
      content: payload.content || undefined,
      attachments: payload.attachments,
      author: lead.name,
    });
    setComposeOpen(false);
    onActivity?.();
  }

  function onCloseStage(): void {
    // 양식 모달(수령·품질확인서) 흐름은 별도 작업. Phase 1: 임시 안내.
    if (typeof window !== "undefined") {
      window.alert(
        "[Phase 1] 종료 단계 진입은 양식 모달(수령·품질확인서) 흐름으로 별도 작업입니다.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <InfoCard />

      <CollapsibleSection title="신청 정보" approved>
        {requestInfoTable}
      </CollapsibleSection>

      <CollapsibleSection title="최종 협의 내용 · 계약 정보" locked>
        <p className="text-[11px] text-[var(--color-text-tertiary,#9ca3af)]">
          협의 및 계약 단계에서 잠금된 내용입니다. 펼침 시 표시되며, 이 단계에서는 수정 불가.
        </p>
      </CollapsibleSection>

      <FeedbackHistoryCard formId={formId} onCompose={() => setComposeOpen(true)} />

      {/* 채팅 패널 — 전체 폭, 고정 높이. 사람 대화만(시스템 자동 메시지 없음). */}
      <div className="relative h-[320px]">
        <div className="absolute inset-0">{chatPanel}</div>
      </div>

      {/* 종료 단계로 — 페이지 하단 전체 폭. */}
      <div>
        <button
          type="button"
          onClick={onCloseStage}
          className="flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-white transition hover:brightness-110"
          style={{ background: "#D4533E", padding: 11, borderRadius: 8 }}
        >
          종료 단계로
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        <p className="mt-1.5 text-center text-[9px] text-[var(--color-text-tertiary,#9ca3af)]">
          최종 데이터를 받고 필요한 피드백까지 마쳤다면 클릭 → 양식 모달
        </p>
      </div>

      {composeOpen && (
        <FeedbackComposeModal
          onClose={() => setComposeOpen(false)}
          onSubmit={onSubmitFeedback}
        />
      )}
    </div>
  );
}

/** 안내 카드 — 진행 단계 동작 설명. */
function InfoCard() {
  return (
    <section
      className="flex items-start gap-2"
      style={{ background: "#FCF3F0", border: "0.5px solid #EFC4B9", borderRadius: 10, padding: "9px 12px" }}
    >
      <InfoIcon size={15} aria-hidden="true" className="mt-px shrink-0 text-[#D4533E]" />
      <p className="text-[11px] text-[#993C1D]" style={{ lineHeight: 1.7 }}>
        데이터는 메일·SharePoint로 주고받습니다. 받은 데이터를 확인한 후 피드백을 작성해 주세요. 모든 작업이 끝나면 [종료 단계로]를 눌러 다음 단계로 넘어갑니다.
      </p>
    </section>
  );
}

/** 접힘 카드 — 신청 정보 / 협의·계약 결과 등에 공용. */
function CollapsibleSection({
  title,
  approved,
  locked,
  children,
}: {
  title: string;
  approved?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{ borderRadius: 10, padding: "9px 12px" }}
    >
      <header className="flex items-center gap-1.5">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[12px] font-medium text-gray-900 dark:text-gray-100">{title}</h3>
        {approved && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <CircleCheck size={11} aria-hidden="true" /> 승인 완료
          </span>
        )}
        {locked && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <Lock size={11} aria-hidden="true" /> 완료 (잠금)
          </span>
        )}
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
