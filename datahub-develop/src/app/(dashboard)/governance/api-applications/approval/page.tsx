// API 활용 계획서 · 1단계 기획 · 전자결재 품의.
//   결재선 + G Portal 전자결재 진행(결재 본문 표 미리보기 + 복사/이동 버튼).
//   데이터 신청과 달리 통보 대상 섹션은 두지 않음.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  FileText,
  Info,
  Route,
} from "lucide-react";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { ApiProcessStepper } from "@/components/governance/ApiProcess/ApiProcessStepper";
import { ApprovalBodyInlineTable } from "@/components/governance/ApprovalBodyInlineTable";
import { buildApiApprovalData } from "@/lib/governance/forms/api-approval-data";
import {
  generateApprovalHtml,
  generateApprovalText,
} from "@/lib/governance/forms/application-preview";
import { copyHtmlAndPlain } from "@/lib/governance/forms/clipboard-copy";

const G_PORTAL_URL = "https://gportal.lgresearch.ai/portal/main/portalMain.do";

// 데모용 요청서 데이터 — 실 폼이 생기면 storage / API 에서 로드.
const DEMO_APPLICANT = { name: "김데이터", department: "AI Platform" };
const DEMO_FORM = {
  projectName: "2026 고객 행동 분석 플랫폼 구축",
  apiPurpose: "LLM 기반 리포트 자동 생성 및 데이터 분석 워크플로우 효율화",
  services: [
    {
      serviceName: "Claude API",
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      currency: "USD",
      estimatedCost: 3000,
    },
  ],
};

export default function Page() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  const approvalData = useMemo(
    () => buildApiApprovalData(DEMO_APPLICANT, DEMO_FORM),
    [],
  );

  const onCopy = async () => {
    const html = generateApprovalHtml(approvalData);
    const plain = generateApprovalText(approvalData);
    const r = await copyHtmlAndPlain(html, plain);
    if (r.ok) {
      setToast(
        r.mode === "html"
          ? "결재 본문이 복사되었습니다. G Portal 전자결재 본문에 붙여 넣으면 표로 표시됩니다."
          : "결재 본문이 복사되었습니다. (브라우저 호환성 문제로 텍스트 형태)",
      );
    } else {
      setToast("복사에 실패했습니다. 표를 직접 선택해 복사해 주세요.");
    }
    setTimeout(() => setToast(null), 3000);
  };

  const openGPortal = () => {
    window.open(G_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "API 활용 계획서", href: "/governance/api-applications/planning" },
          { label: "전자결재 품의" },
        ]}
      />

      <ApiProcessStepper currentSubstep="approval" />

      {/* 안내 배너 */}
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-lg bg-blue-50 px-3.5 py-3 dark:bg-blue-950/40"
      >
        <Info
          size={16}
          aria-hidden="true"
          className="mt-px shrink-0 text-blue-700 dark:text-blue-300"
        />
        <span className="text-[13px] leading-relaxed text-blue-700 dark:text-blue-300">
          Datahub에서 작성한 요청서를 기반으로{" "}
          <strong className="font-medium">G Portal 전자결재</strong>에 품의를 작성하고 승인 요청을 진행합니다.
        </span>
      </div>

      {/* 결재선 카드 */}
      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-2 flex items-center gap-1.5">
          <Route size={14} aria-hidden="true" className="text-gray-600 dark:text-gray-300" />
          <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">결재선</h2>
        </header>
        <div className="rounded-md bg-gray-50 px-3 py-2.5 text-[13px] text-gray-800 dark:bg-gray-800/40 dark:text-gray-200">
          요청자의 소속 조직장 전결
        </div>
      </section>

      {/* G Portal 전자결재 진행 카드 */}
      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-1 flex items-center gap-1.5">
          <ExternalLink
            size={14}
            aria-hidden="true"
            className="text-blue-700 dark:text-blue-300"
          />
          <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            G Portal 전자결재 진행
          </h2>
        </header>
        <p className="mb-3.5 text-[12px] text-gray-500 dark:text-gray-400">
          아래 표를 복사하면 G Portal 전자결재 본문에 그대로 붙여 넣을 수 있습니다.
        </p>

        {/* 결재 본문 미리보기 */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <FileText
              size={13}
              aria-hidden="true"
              className="text-gray-600 dark:text-gray-300"
            />
            <span className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
              결재 본문
            </span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              미리보기
            </span>
          </div>
          <ApprovalBodyInlineTable data={approvalData} />
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Copy size={13} aria-hidden="true" />
            결재 본문 복사
          </button>
          <button
            type="button"
            onClick={openGPortal}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-[13px] font-medium text-blue-700 transition hover:brightness-95 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300"
          >
            G Portal 전자결재로 이동
            <ExternalLink size={12} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Link
          href="/governance/api-applications/form"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          요청서 작성 다시 보기
        </Link>
        <button
          type="button"
          onClick={() => router.push("/governance/api-applications/operate")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark"
        >
          2단계 운영으로 진행
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>

      {toast && (
        <div
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
