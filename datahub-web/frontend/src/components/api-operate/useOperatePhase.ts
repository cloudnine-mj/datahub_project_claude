// API 활용 계획서 · 2단계 운영 — 3 substep 의 단계별 활성화 상태 관리 hook.
//   초기: apiUsage=current, costProcess=locked, finalStore=locked.
//   API 활용 확인 → costProcess current
//   비용 처리 완료 → finalStore current
//   결과물 적재 완료 → finalStore done
//
//   비용 처리 substep 내부에는 월별 비용 기록 누적 배열을 별도로 관리.

"use client";

import { useCallback, useState } from "react";

export type StepStatus = "locked" | "current" | "done";

export type Currency = "USD" | "KRW" | "OTHER";

export interface ApiUsageStep {
  status: StepStatus;
  /** YYYY-MM-DD. */
  startDate: string;
  paymentMethod: string;
  completedAt?: string;
}

export interface CostRecord {
  id: string;
  /** "YYYY-MM" — 자동 생성. */
  month: string;
  services: string[];
  currency: Currency;
  amount: number;
}

export interface CostProcessStep {
  status: StepStatus;
  approvalNumber: string;
  costCenter: string;
  costRecords: CostRecord[];
  completedAt?: string;
}

export interface FinalStoreStep {
  status: StepStatus;
  storageUploaded: boolean;
  metadataCompleted: boolean;
  dataCardCompleted: boolean;
  completedAt?: string;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useOperatePhase() {
  const [apiUsage, setApiUsage] = useState<ApiUsageStep>({
    status: "current",
    startDate: "",
    paymentMethod: "",
  });
  const [costProcess, setCostProcess] = useState<CostProcessStep>({
    status: "current",
    // 1단계 전자결재 품의 substep 에서 발급된 품의번호 — 데모 데이터.
    approvalNumber: "P-2026-0418",
    costCenter: "Data Governance Team",
    costRecords: [],
  });
  const [finalStore, setFinalStore] = useState<FinalStoreStep>({
    status: "current",
    storageUploaded: false,
    metadataCompleted: false,
    dataCardCompleted: false,
  });

  // — API 활용 —
  const onChangeStartDate = useCallback((v: string) => {
    setApiUsage((s) => ({ ...s, startDate: v }));
  }, []);
  const onChangePaymentMethod = useCallback((v: string) => {
    setApiUsage((s) => ({ ...s, paymentMethod: v }));
  }, []);
  const completeApiUsage = useCallback(() => {
    setApiUsage((s) => ({ ...s, status: "done", completedAt: today() }));
    setCostProcess((c) => ({ ...c, status: "current" }));
  }, []);

  // — 비용 처리 —
  const addCostRecord = useCallback(
    (input: { services: string[]; currency: Currency; amount: number }) => {
      setCostProcess((c) => ({
        ...c,
        costRecords: [
          ...c.costRecords,
          {
            id: `cost-${Date.now()}`,
            month: currentMonth(),
            services: input.services,
            currency: input.currency,
            amount: input.amount,
          },
        ],
      }));
    },
    [],
  );
  const completeCostProcess = useCallback(() => {
    setCostProcess((c) => ({ ...c, status: "done", completedAt: today() }));
    setFinalStore((f) => ({ ...f, status: "current" }));
  }, []);

  // — 결과물 적재 —
  const toggleStorageUploaded = useCallback(() => {
    setFinalStore((f) => ({ ...f, storageUploaded: !f.storageUploaded }));
  }, []);
  const toggleMetadata = useCallback(() => {
    setFinalStore((f) => ({ ...f, metadataCompleted: !f.metadataCompleted }));
  }, []);
  const toggleDataCard = useCallback(() => {
    setFinalStore((f) => ({ ...f, dataCardCompleted: !f.dataCardCompleted }));
  }, []);
  const completeFinalStore = useCallback(() => {
    setFinalStore((f) => ({ ...f, status: "done", completedAt: today() }));
  }, []);

  const allDone =
    apiUsage.status === "done" &&
    costProcess.status === "done" &&
    finalStore.status === "done";

  return {
    apiUsage,
    costProcess,
    finalStore,
    allDone,
    onChangeStartDate,
    onChangePaymentMethod,
    completeApiUsage,
    addCostRecord,
    completeCostProcess,
    toggleStorageUploaded,
    toggleMetadata,
    toggleDataCard,
    completeFinalStore,
  };
}
