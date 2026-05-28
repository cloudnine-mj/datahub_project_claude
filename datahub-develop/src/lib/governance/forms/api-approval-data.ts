// API 활용 계획서 — 전자결재 본문 데이터 빌더.
//   기존 데이터 신청과 달리 API 폼은 schema 가 아직 없어, 인자로 받은 구조에서 직접
//   ApprovalData 를 구성. 정식 폼이 생기면 schema 기반으로 교체.

import type { ApprovalData, ApprovalRow } from "./application-preview";

export interface ApiServiceEntry {
  serviceName: string;
  startDate: string;
  endDate: string;
  /** 'USD' | 'KRW' | 그 외 문자열(예: 'EUR'). */
  currency: string;
  estimatedCost: number;
}

export interface ApiApplicantInfo {
  name: string;
  department: string;
}

export interface ApiApplicationForm {
  projectName: string;
  apiPurpose: string;
  services: ApiServiceEntry[];
}

function formatPeriod(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "";
  return `${startDate || "?"} ~ ${endDate || "?"}`;
}

function formatCost(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString()}`;
}

export function buildApiApprovalData(
  applicant: ApiApplicantInfo,
  form: ApiApplicationForm,
): ApprovalData {
  const rows: ApprovalRow[] = [];

  const applicantStr = applicant.department
    ? `${applicant.name} (${applicant.department})`
    : applicant.name;
  rows.push({ label: "요청자", value: applicantStr });

  if (form.projectName.trim()) {
    rows.push({ label: "연관 프로젝트", value: form.projectName });
  }
  if (form.apiPurpose.trim()) {
    rows.push({ label: "API 사용 목적", value: form.apiPurpose });
  }

  form.services.forEach((svc, i) => {
    const parts = [
      svc.serviceName,
      formatPeriod(svc.startDate, svc.endDate),
      formatCost(svc.currency, svc.estimatedCost),
    ].filter(Boolean);
    rows.push({ label: `사용 서비스 ${i + 1}`, value: parts.join(" / ") });
  });

  // 총 예상 비용 — 통화별 합계가 가능하므로 첫 서비스 통화 기준 단순 합계.
  if (form.services.length > 0) {
    const total = form.services.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
    const currency = form.services[0].currency;
    rows.push({ label: "총 예상 비용", value: formatCost(currency, total) });
  }

  rows.push({ label: "비용 처리", value: "지급수수료-API" });

  return {
    title: "API 활용 요청서",
    rows,
  };
}
