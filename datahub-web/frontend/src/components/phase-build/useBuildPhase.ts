// 2단계(구축) 페이지 — 3 substep 의 단계별 활성화 상태 관리 hook.
//   초기: contract=current, 나머지=locked.
//   한 번 done 된 단계는 되돌릴 수 없음 (정책상 안전).
//   계약 완료 → delivery current / 검수 완료 → final current / 최종 수령 → final done.

"use client";

import { useCallback, useState } from "react";

export type StepStatus = "locked" | "current" | "done";

export interface IntermediateUpload {
  id: string;
  label: string;
  uploadedAt: string;
}

export interface InspectionFeedback {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface ContractStep {
  status: StepStatus;
  approvalNumber: string;
  agreementConfirmed: boolean;
  completedAt?: string;
}

export interface DeliveryStep {
  status: StepStatus;
  intermediateUploads: IntermediateUpload[];
  feedbacks: InspectionFeedback[];
  completedAt?: string;
}

export interface FinalStep {
  status: StepStatus;
  received: boolean;
  completedAt?: string;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function useBuildPhase() {
  const [contract, setContract] = useState<ContractStep>({
    status: "current",
    approvalNumber: "",
    agreementConfirmed: false,
  });
  const [delivery, setDelivery] = useState<DeliveryStep>({
    status: "current",
    intermediateUploads: [],
    feedbacks: [],
  });
  const [final, setFinal] = useState<FinalStep>({ status: "current", received: false });

  const onChangeApprovalNumber = useCallback((v: string) => {
    setContract((c) => ({ ...c, approvalNumber: v }));
  }, []);

  const onToggleAgreement = useCallback(() => {
    setContract((c) => ({ ...c, agreementConfirmed: !c.agreementConfirmed }));
  }, []);

  const completeContract = useCallback(() => {
    setContract((c) => ({ ...c, status: "done", completedAt: today() }));
    setDelivery((d) => ({ ...d, status: "current" }));
  }, []);

  const addIntermediateUpload = useCallback(() => {
    setDelivery((d) => {
      const n = d.intermediateUploads.length + 1;
      const upload: IntermediateUpload = {
        id: `up-${Date.now()}`,
        label: `${n}차 납품`,
        uploadedAt: shortDate(),
      };
      return { ...d, intermediateUploads: [...d.intermediateUploads, upload] };
    });
  }, []);

  const addFeedback = useCallback((content: string) => {
    setDelivery((d) => ({
      ...d,
      feedbacks: [
        ...d.feedbacks,
        {
          id: `fb-${Date.now()}`,
          author: "김데이터",
          content,
          createdAt: shortDate(),
        },
      ],
    }));
  }, []);

  const completeDelivery = useCallback(() => {
    setDelivery((d) => ({ ...d, status: "done", completedAt: today() }));
    setFinal((f) => ({ ...f, status: "current" }));
  }, []);

  const onToggleFinalReceived = useCallback(() => {
    setFinal((f) => ({ ...f, received: !f.received }));
  }, []);

  const completeFinal = useCallback(() => {
    setFinal((f) => ({ ...f, status: "done", received: true, completedAt: today() }));
  }, []);

  const allDone =
    contract.status === "done" && delivery.status === "done" && final.status === "done";

  return {
    contract,
    delivery,
    final,
    allDone,
    onChangeApprovalNumber,
    onToggleAgreement,
    completeContract,
    addIntermediateUpload,
    addFeedback,
    completeDelivery,
    onToggleFinalReceived,
    completeFinal,
  };
}
