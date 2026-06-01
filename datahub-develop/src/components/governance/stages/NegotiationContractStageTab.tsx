// 협의·계약 통합 단계(4단계 막대 기준 2/4) 상세 탭 — 용역 제작(data_production) 본문.
//
// 협의 단계와 계약 단계를 하나의 페이지로 통합. 담당자가 최종 협의 내용(4필드) + 계약 정보
//   (품의번호) 를 모두 채운 뒤 [진행 단계로] 한 번으로 진행 단계로 전환.
//
// 레이아웃: 2열 그리드 (좌측 카드 컬럼 + 우측 채팅, items-stretch).
//   좌측: 안내 / 신청 정보(접힘) / 최종 협의 내용 / 계약 정보(EAS) / 협의 자료 / [진행 단계로]
//   우측: 담당자와 소통 채팅 (부모가 전달한 ChatPanel 그대로 재사용)
//
// 권한 (Phase 1): 분기 없음 — 모든 사용자가 모든 동작 동일 사용. 다운로드/변경이력 없음.
//
// 단계 전환은 모달의 [진행 단계로 →] 에서만 발생(자동 전환 금지). 확정 시:
//   1) stage_transition 이력 기록(진행 단계 진입)
//   2) 부모 onAdvanceToProgress() → service-stage 를 진행으로 갱신
//   채팅 단계 구분선은 진행 단계 메시지 발생 시 ChatPanel 이 chat-stages 맵으로 자동 노출.

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowRightCircle, ChevronDown, CircleCheck } from "lucide-react";
import { api, type FormDetail } from "@/lib/governance/api-client-full";
import { getChatAssignee } from "@/lib/governance/chat-assignee";
import {
  ensureWorkCountDefault,
  readNegotiation,
  writeNegotiation,
  NEGOTIATION_FIELDS,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import { readContract, writeContract } from "@/lib/governance/contract-storage";
import { AgreementCard } from "./negotiation-contract/AgreementCard";
import { EasInfoCard } from "./negotiation-contract/EasInfoCard";
import { NegotiationFilesCard } from "./negotiation-contract/NegotiationFilesCard";
import { ProceedToProgressModal } from "./negotiation-contract/ProceedToProgressModal";

interface Props {
  formId: string;
  form: FormDetail;
  /** 신청 정보 표(헤더 제외) — 부모가 만든 표를 접힘 카드 본문으로 재사용. */
  requestInfoTable: ReactNode;
  /** 우측 채팅 패널 — 부모가 만든 ChatPanel(fillParent) 그대로. */
  chatPanel: ReactNode;
  /** 진행 단계 전환 — 부모가 service-stage 를 진행으로 갱신. */
  onAdvanceToProgress: () => void;
  /** 이력 변경 후 부모가 폼을 다시 불러오도록 알림(타임라인 갱신). */
  onActivity?: () => void;
}

export function NegotiationContractStageTab({
  formId,
  form,
  requestInfoTable,
  chatPanel,
  onAdvanceToProgress,
  onActivity,
}: Props) {
  const lead = useMemo(() => getChatAssignee(), []);
  const [negotiation, setNegotiation] = useState<NegotiationResult>(() =>
    readNegotiation(formId),
  );
  const [contractNo, setContractNo] = useState<string>(
    () => readContract(formId).easApprovalNumber,
  );
  const [modalOpen, setModalOpen] = useState(false);

  // 작업 건수 초기값 — 신청서 '목표 데이터 수량' 으로 1회 자동 채움(미입력 시에만).
  useEffect(() => {
    const raw = form.payload?.["목표_데이터_수량"];
    const def = raw === undefined || raw === null ? "" : String(raw);
    ensureWorkCountDefault(formId, def);
    setNegotiation(readNegotiation(formId));
    setContractNo(readContract(formId).easApprovalNumber);
  }, [formId, form]);

  function onAgreementField(key: NegotiationField, next: string): void {
    setNegotiation(writeNegotiation(formId, { [key]: next }));
  }

  function onContractField(next: string): void {
    setContractNo(writeContract(formId, { easApprovalNumber: next }).easApprovalNumber);
  }

  const allFilled =
    NEGOTIATION_FIELDS.every((k) => negotiation[k].trim().length > 0) &&
    contractNo.trim().length > 0;

  // [진행 단계로 →] 확정 — 이력 기록 + 단계 갱신.
  function onProceedToProgress(): void {
    api
      .appendFormEvent(formId, {
        action: "stage_transition",
        comment: "진행 단계 진입",
        actorName: lead.name,
        actorRole: "lead",
      })
      .then(() => onActivity?.())
      .catch(() => {
        /* ignore */
      });
    onAdvanceToProgress();
    setModalOpen(false);
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        <InfoCard />

        {/* 신청 정보 카드 — 펼치면 참조자 행 포함(편집 가능). 별도 참조자 카드는 두지 않음. */}
        <CollapsibleRequestInfo>{requestInfoTable}</CollapsibleRequestInfo>

        <AgreementCard value={negotiation} onField={onAgreementField} />

        <EasInfoCard value={contractNo} onCommit={onContractField} />

        <NegotiationFilesCard formId={formId} />

        {/* Phase 1 — 권한 분기 없이 모든 사용자에게 노출. 협의 4필드 + 품의번호 모두 입력 시 활성. */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!allFilled}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#D4533E] px-4 py-[11px] text-[12px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
        >
          진행 단계로
          <ArrowRight size={14} aria-hidden="true" />
        </button>
        <p className="text-center text-[11px] text-gray-400">
          최종 협의 내용 4필드 + 품의번호 모두 입력 시 활성
        </p>
      </div>

      <div className="min-h-0">{chatPanel}</div>

      {modalOpen && (
        <ProceedToProgressModal
          negotiation={negotiation}
          contractNo={contractNo}
          onAgreementField={onAgreementField}
          onContractField={onContractField}
          onProceed={onProceedToProgress}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

/** 안내 카드 — 제목 없이 본문만. */
function InfoCard() {
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
      <p className="text-[11px] text-[#993C1D]" style={{ lineHeight: 1.7 }}>
        작업 내용 및 업체, 견적을 논의하세요. 협의가 종료되면 담당자가 최종 협의 내용을 작성하고 EAS 품의번호를 입력한 후 [진행 단계로]를 눌러 다음 단계로 넘어갑니다.
      </p>
    </section>
  );
}

/** 신청 정보 카드 — 접힘 가능. 기본 접힘, 펼치면 신청서 표 노출. */
function CollapsibleRequestInfo({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="flex items-center gap-1.5">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
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
