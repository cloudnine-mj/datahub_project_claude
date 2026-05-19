export type GovernanceStatus = "in_review" | "approved" | "rejected" | "draft";
export type GovernancePriority = "low" | "medium" | "high" | "critical";

export interface GovernanceRequest {
  id: string;
  title: string;
  type:
    | "Model Release"
    | "Data Access"
    | "Dataset Publishing"
    | "Pipeline Review";
  requester: { name: string; initials: string; org: string };
  approvers: { name: string; initials: string }[];
  status: GovernanceStatus;
  priority: GovernancePriority;
  relatedRepo: string;
  createdAt: string;
  updatedAt: string;
  description: string;
}

export const governanceRequests: GovernanceRequest[] = [
  {
    id: "GR-2026-0042",
    title: "exaone-3.5-instruct 1.2.0 프로덕션 릴리즈 승인 요청",
    type: "Model Release",
    requester: { name: "Sanghyun Seo", initials: "SS", org: "lg-research" },
    approvers: [
      { name: "Jieun Kim", initials: "JK" },
      { name: "Minjun Park", initials: "MP" },
    ],
    status: "in_review",
    priority: "high",
    relatedRepo: "lgair/exaone-3.5-instruct",
    createdAt: "2026-04-28",
    updatedAt: "3 hours ago",
    description:
      "Korean QA 벤치마크 점수가 기존 1.1.0 대비 +2.4pt 상승했습니다. Production endpoint 교체 및 SDK 재배포가 필요합니다.",
  },
  {
    id: "GR-2026-0041",
    title: "indoor-air-quality-2024 데이터셋 외부 공개",
    type: "Dataset Publishing",
    requester: { name: "Soyeon Choi", initials: "SC", org: "lg-air-science" },
    approvers: [
      { name: "Jieun Kim", initials: "JK" },
      { name: "Sanghyun Seo", initials: "SS" },
    ],
    status: "in_review",
    priority: "medium",
    relatedRepo: "lg-air-science/indoor-air-quality-2024",
    createdAt: "2026-04-27",
    updatedAt: "1 day ago",
    description:
      "1,200개 LG 스마트홈 디바이스에서 수집된 실내 공기질 센서 데이터입니다. 법무 검토 후 학계 공개를 요청합니다.",
  },
  {
    id: "GR-2026-0040",
    title: "korean-ner-corpus 접근 권한 — Vehicle OS 팀",
    type: "Data Access",
    requester: { name: "Minjun Park", initials: "MP", org: "lg-vehicle-os" },
    approvers: [{ name: "Sanghyun Seo", initials: "SS" }],
    status: "approved",
    priority: "low",
    relatedRepo: "lg-data/korean-ner-corpus",
    createdAt: "2026-04-25",
    updatedAt: "5 days ago",
    description:
      "차량 음성 명령 NLU 학습용 데이터셋 접근이 필요합니다. read 권한 90일.",
  },
  {
    id: "GR-2026-0039",
    title: "speech-recognition-v2 학습 파이프라인 GPU 64대 증설",
    type: "Pipeline Review",
    requester: { name: "Jieun Kim", initials: "JK", org: "lg-research" },
    approvers: [
      { name: "Sanghyun Seo", initials: "SS" },
      { name: "Soyeon Choi", initials: "SC" },
    ],
    status: "approved",
    priority: "high",
    relatedRepo: "lg-research/speech-recognition-v2",
    createdAt: "2026-04-22",
    updatedAt: "1 week ago",
    description:
      "분기 학습 일정 단축을 위한 H100 GPU 추가 할당. 비용 +12% 예상.",
  },
  {
    id: "GR-2026-0038",
    title: "appliance-logs-v3 외부 마케팅팀 공유",
    type: "Data Access",
    requester: { name: "Soyeon Choi", initials: "SC", org: "lg-data" },
    approvers: [{ name: "Sanghyun Seo", initials: "SS" }],
    status: "rejected",
    priority: "low",
    relatedRepo: "lg-data/appliance-logs-v3",
    createdAt: "2026-04-19",
    updatedAt: "10 days ago",
    description:
      "마케팅 분석을 위한 가전 사용 로그 공유. 개인정보 식별 위험으로 반려.",
  },
  {
    id: "GR-2026-0037",
    title: "polymer-property-model 1.0 릴리즈",
    type: "Model Release",
    requester: { name: "Jieun Kim", initials: "JK", org: "lg-chem-ai" },
    approvers: [{ name: "Sanghyun Seo", initials: "SS" }],
    status: "in_review",
    priority: "critical",
    relatedRepo: "lg-chem-ai/polymer-property-model",
    createdAt: "2026-04-18",
    updatedAt: "12 days ago",
    description:
      "신소재 특성 예측 모델의 첫 프로덕션 릴리즈. 안전성 검토 필요.",
  },
];

export const statusLabel: Record<GovernanceStatus, string> = {
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
  draft: "Draft",
};

export const statusBadgeClass: Record<GovernanceStatus, string> = {
  in_review: "bg-orange-50 text-accent-orange border-orange-200",
  approved: "bg-green-50 text-accent-green border-green-200",
  rejected: "bg-red-50 text-brand border-red-200",
  draft: "bg-bg-surface text-text-secondary border-dh-border",
};

export const priorityBadgeClass: Record<GovernancePriority, string> = {
  low: "bg-blue-50 text-accent-blue border-blue-200",
  medium: "bg-purple-50 text-accent-purple border-purple-200",
  high: "bg-orange-50 text-accent-orange border-orange-200",
  critical: "bg-red-50 text-brand border-red-200",
};

export function getGovernanceRequest(id: string) {
  return governanceRequests.find((r) => r.id === id) ?? governanceRequests[0];
}
