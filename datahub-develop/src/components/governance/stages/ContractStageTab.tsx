// 계약 단계(3/5) 상세 탭 — 용역 제작(data_production) 폼 계약 단계 본문.
//
// 레이아웃: 2열 그리드 (좌측 카드 컬럼 + 우측 채팅, items-stretch).
//   좌측: 안내 카드 / 신청 정보(접힘) / 최종 협의 내용(수정+변경이력) / 계약 정보(EAS) /
//         계약 자료 / [진행 단계로]
//   우측: 담당자와 소통 채팅 (부모가 전달한 ChatPanel 그대로 재사용)
//
// 권한 (Phase 1): 분기 없음 — 모든 사용자가 모든 동작(편집/다운로드/버튼) 동일 사용.
//   editable prop 은 Phase 2 확장용으로만 열어두고 기본 true.
//
// 단계 전환은 모달의 [진행 단계로 →] 에서만 발생(자동 전환 금지). 확정 시:
//   1) stage_transition 이력 기록(진행 단계 진입)
//   2) 부모 onAdvanceToProgress() → serviceStage 를 진행(3) 으로 갱신
//   채팅 단계 구분선은 진행 단계 메시지 발생 시 ChatPanel 이 chat-stages 맵으로 자동 노출.

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowRightCircle, ChevronDown, CircleCheck } from "lucide-react";
import { api, type FormDetail } from "@/lib/governance/api-client-full";
import { getChatAssignee } from "@/lib/governance/chat-assignee";
import {
  formatAmount,
  readNegotiation,
  writeNegotiation,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import { initSystemEntry, pushChange } from "@/lib/governance/agreement-change-log";
import { readContract, writeContract } from "@/lib/governance/contract-storage";
import {
  exportNegotiationToPdf,
  exportNegotiationToXlsx,
  type NegotiationExportData,
} from "@/lib/governance/negotiation-export";
import { AgreementCard } from "./contract/AgreementCard";
import { EasInfoCard } from "./contract/EasInfoCard";
import { ContractFilesCard } from "./contract/ContractFilesCard";
import { ProceedToProgressModal } from "./contract/ProceedToProgressModal";

interface Props {
  formId: string;
  form: FormDetail;
  /** 신청 정보 표(헤더 제외) — 부모가 만든 표를 접힘 카드 본문으로 재사용. */
  requestInfoTable: ReactNode;
  /** 우측 채팅 패널 — 부모가 만든 ChatPanel(fillParent) 그대로. */
  chatPanel: ReactNode;
  /** 진행 단계 전환 — 부모가 serviceStage 를 진행(3) 으로 갱신. */
  onAdvanceToProgress: () => void;
  /** 이력 변경 후 부모가 폼을 다시 불러오도록 알림(타임라인 갱신). */
  onActivity?: () => void;
}

export function ContractStageTab({
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

  // 계약 단계 진입 — changeLog 시스템 항목 1건 자동 생성(없을 때만).
  useEffect(() => {
    const next = initSystemEntry(formId, lead.name);
    setNegotiation(next);
    setContractNo(readContract(formId).easApprovalNumber);
  }, [formId, lead.name]);

  // 최종 협의 내용 셀 편집 — 값이 실제 바뀌면 changeLog 에 기록 후 저장.
  function onField(key: NegotiationField, next: string): void {
    const before = negotiation[key];
    if (before === next) return;
    writeNegotiation(formId, { [key]: next });
    pushChange(formId, key, before, next, lead.name);
    setNegotiation(readNegotiation(formId));
  }

  function onContractField(next: string): void {
    const saved = writeContract(formId, { easApprovalNumber: next });
    setContractNo(saved.easApprovalNumber);
  }

  function buildExportData(): NegotiationExportData {
    const datasetRaw = form.payload?.["데이터셋_이름"];
    const dept = form.submitter_department ? ` (${form.submitter_department})` : "";
    const now = new Date();
    const issuedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return {
      requestNo: form.request_no,
      datasetName:
        datasetRaw === undefined || datasetRaw === null ? "" : String(datasetRaw),
      applicant: `${form.submitter_name}${dept}`,
      assignee: lead.name,
      issuedAt,
      selectedVendor: negotiation.selectedVendor,
      amount: formatAmount(negotiation.amount),
      period: negotiation.period,
      workCount: negotiation.workCount,
    };
  }

  function onDownload(format: "xlsx" | "pdf"): void {
    const data = buildExportData();
    const run = format === "xlsx" ? exportNegotiationToXlsx : exportNegotiationToPdf;
    void run(data).catch(() => {
      /* 다운로드 실패는 조용히 무시(Phase 1) */
    });
  }

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
    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-3">
        <InfoCard />

        <CollapsibleRequestInfo>{requestInfoTable}</CollapsibleRequestInfo>

        <AgreementCard value={negotiation} onField={onField} onDownload={onDownload} />

        <EasInfoCard value={contractNo} onCommit={onContractField} />

        <ContractFilesCard formId={formId} />

        {/* Phase 1 — 권한 분기 없이 모든 사용자에게 노출. */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#D4533E] px-4 py-[11px] text-[12px] font-medium text-white transition hover:brightness-110"
        >
          진행 단계로
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0">{chatPanel}</div>

      {modalOpen && (
        <ProceedToProgressModal
          value={contractNo}
          onField={onContractField}
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
        EAS에서 계약을 진행하고 품의번호를 입력하세요. 계약 중 협의 내용이 조정되면 자유롭게 수정할 수 있으며, 변경 이력은 자동으로 기록됩니다. 입력이 완료되면 담당자가 [진행 단계로]를 눌러 다음 단계로 넘어갑니다.
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
