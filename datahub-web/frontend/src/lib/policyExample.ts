/**
 * 정책 작성 폼의 예시 데이터.
 *
 * Admin 이 "예시 보기" 버튼 클릭 시 모달로 보여주거나,
 * "이 예시로 채우기" 클릭 시 폼 필드에 자동 입력하는 데 사용한다.
 *
 * 시드(`backend/app/seed.py`)의 '데이터 적재 정책' 항목과 동일한 값.
 */

import type { Severity } from "./api";

export interface PolicyExample {
  /** 작성자가 식별할 라벨 — 모달에서 예시 이름으로 사용 */
  label: string;
  title: string;
  category: string;
  content: string;
  // 메타필드
  summary: string;
  tags: string[];
  severity: Severity;
  applies_to: string;
  tldr: string;
  action_items: string[];
  examples: string;
}

export const POLICY_EXAMPLE: PolicyExample = {
  label: "데이터 적재 정책 (모범 작성 사례)",
  title: "데이터 적재 정책",
  category: "정책",
  summary: "신규 데이터셋 등록 시 메타데이터·라이선스·소유권 검증을 필수화합니다.",
  tags: ["적재", "라이선스", "메타데이터"],
  severity: "required",
  applies_to: "신규 데이터셋을 등록하는 모든 데이터 등록자",
  tldr:
    "새 데이터셋을 등록하기 전에 라이선스·소유권·PII 여부를 확인하고, " +
    "필수 메타데이터 5개 항목을 빠짐없이 채우세요.",
  action_items: [
    "데이터셋 출처/소유권 확인",
    "라이선스 명시 (CC-BY, 사내 전용 등)",
    "PII 포함 여부 확인 — 포함 시 보안팀 사전 승인",
    "메타데이터 5종 입력 (이름, 설명, 출처, 갱신주기, 담당자)",
    "Compliance 담당자 사인오프",
  ],
  content:
    "1. 적용 대상\n신규 데이터셋을 DataHub 에 등록하는 모든 사용자.\n\n" +
    "2. 등록 절차\n등록 화면에서 메타데이터 5개 항목을 입력하고, " +
    "라이선스·소유권 정보를 명시해야 합니다.\n\n" +
    "3. PII 데이터\n개인정보가 포함된 경우 보안팀의 사전 승인이 필수입니다.",
  examples:
    "올바른 사례\n- 라이선스: CC-BY-4.0 명시, 출처 URL 첨부, 담당자 이메일 기재\n\n" +
    "잘못된 사례\n- 라이선스 미기재, 메타데이터 항목 누락, PII 포함 데이터를 무신고 등록",
};
