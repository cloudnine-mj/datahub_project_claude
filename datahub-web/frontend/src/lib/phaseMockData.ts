// 2단계(구축) / 3단계(적재) 데모용 mock 데이터.
//   실제 API 연동 시 fetch 로 교체. 신청 유형(용역/구매/구독) 별로 회차 구조가 달라
//   실제 환경에선 type 분기를 거쳐 별도 fetch.

import type { ContractInfo } from "@/components/phase-build/ContractStatusBlock";
import type { DeliveryRound } from "@/components/phase-build/DeliveryRoundsBlock";
import type { InspectionFeedback } from "@/components/phase-build/InspectionFeedbackBlock";
import type { DatasetUpload } from "@/components/phase-load/DatasetUploadBlock";
import type { DataCardField } from "@/components/phase-load/DataCardBlock";
import type { SettlementStep } from "@/components/phase-load/SettlementBlock";

export const MOCK_CONTRACT: ContractInfo = {
  approvalNumber: "P-2026-0331",
  vendor: "크라우드웍스",
  amount: 16_500_000,
  agreementIncluded: true,
  deliveryDeadline: "2026-07-31",
  totalRounds: 4,
};

export const MOCK_DELIVERY_ROUNDS: DeliveryRound[] = [
  {
    roundNumber: 1,
    status: "completed",
    deliveryDate: "2026-05-31",
    inspector: "김데이터",
    inspectionResult: "passed",
    details: "25% 분량 · 음성 5,000건 · 라벨 정확도 98.2%",
  },
  {
    roundNumber: 2,
    status: "in-progress",
    deliveryDate: "2026-06-15",
    inspectionDeadline: "6/22",
    details: "25% 분량 · 음성 5,000건 · 검수 진행률 40%",
    inspectionProgress: 40,
  },
  {
    roundNumber: 3,
    status: "pending",
    deliveryDate: "2026-07-15",
    details: "",
  },
  {
    roundNumber: 4,
    status: "pending",
    deliveryDate: "2026-07-31",
    details: "",
  },
];

export const MOCK_FEEDBACK: InspectionFeedback[] = [
  {
    id: "fb1",
    roundNumber: 1,
    author: "김데이터",
    createdAt: "5/31",
    content:
      "샘플링 검수 결과 라벨 정확도 98.2%로 기준 충족. 다만 200건 정도에서 화자 구분 오류 발견되어 업체에 재라벨 요청.",
    resolution: { status: "resolved", note: "5/29 재납품 완료" },
  },
];

export const MOCK_DATASET_UPLOAD: DatasetUpload = {
  path: "/datasets/voice/kr-asr-corpus-v3/",
  totalCount: 20_000,
  totalSize: "48.2GB",
  rounds: 4,
  status: "completed",
};

export const MOCK_DATA_CARD_FIELDS: DataCardField[] = [
  {
    id: "basic",
    label: "기본 정보 (이름, 도메인, 형식)",
    status: "auto-filled",
    sourceLabel: "자동 채움",
  },
  {
    id: "license",
    label: "라이선스·활용 범위",
    status: "auto-filled",
    sourceLabel: "신청서에서 가져옴",
  },
  { id: "schema", label: "데이터 스키마 (필드 명세)", status: "needs-input" },
  { id: "sample", label: "샘플 데이터 (3-5건 예시)", status: "needs-input" },
  { id: "quality", label: "품질 지표·검증 결과", status: "needs-input" },
  { id: "usage", label: "활용 가이드·주의사항", status: "optional" },
];

export const MOCK_SETTLEMENT_STEPS: SettlementStep[] = [
  {
    id: "receipt-check",
    label: "최종 데이터 수령·적재 확인",
    status: "pending",
    note: "담당자 검토 대기",
  },
  {
    id: "datacard-check",
    label: "데이터카드 작성 완료 확인",
    status: "pending",
    note: "데이터카드 작성 후",
  },
  {
    id: "settle",
    label: "EAS 품의 비용 정산",
    status: "pending",
    note: "CostCenter: Data Gov.",
  },
  {
    id: "notify",
    label: "작업 종료 통보",
    status: "pending",
    note: "신청자에게 알림",
  },
];
