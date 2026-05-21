// 1. 기획 / substep 3: 전자결재 품의.
//   결재선 카드 + G Portal 전자결재 진행 카드(품의 안내 + 결재 본문 표 미리보기
//   + [결재 본문 복사] / [G Portal 전자결재로 이동]).
//   결재 본문은 sessionStorage 의 신청 유형(TYPE_KEY) 기준 mock 데이터로 구성 — 실 데이터
//   연동 시 api.getForm 으로 교체.

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  Info,
  UsersRound,
} from "lucide-react";
import { PhaseLayout } from "@/components/governance/PhaseLayout";
import {
  buildPhase1SubSteps,
  getPhase1Phases,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/governance/forms/phase1-substeps";
import { usePlanningType } from "@/lib/governance/forms/use-planning-type";
import {
  buildApprovalData,
  generateApprovalHtml,
  generateApprovalText,
  type ApprovalData,
} from "@/lib/governance/forms/application-preview";
import { copyHtmlAndPlain } from "@/lib/governance/forms/clipboard-copy";
import {
  MOCK_SUBMITTED_PAYLOAD,
  type ApplicationType,
} from "@/lib/governance/forms/application-config";
import { isPlanningType } from "@/lib/governance/forms/application-type-meta";
import { useApplicationTypeBreadcrumb } from "@/lib/governance/forms/use-application-type-breadcrumb";
import { ApprovalBodyInlineTable } from "@/components/governance/ApprovalBodyInlineTable";

const TYPE_KEY = "datahub:planningType";
const DEMO_APPLICANT = { name: "Karlo Lee", department: "Data Platform" };
const G_PORTAL_URL = "https://gportal.lgresearch.ai/portal/main/portalMain.do";

const NOTIFY_TARGETS = [
  "AI Biz. Development Team장 (박용민)",
  "Data Governance Team장 (김의순)",
  "Data Governance Team 실무자 (김은솔)",
];

export default function Page() {
  const planningType = usePlanningType();
  const prev = prevPhase1Substep("approval", planningType);
  const next = nextPhase1Substep("approval", planningType);

  const [type, setType] = useState<ApplicationType>("service");
  const [toast, setToast] = useState<string | null>(null);
  const typeCrumb = useApplicationTypeBreadcrumb();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(TYPE_KEY);
    if (isPlanningType(saved)) setType(saved as ApplicationType);
  }, []);

  const approvalData: ApprovalData = useMemo(
    () =>
      buildApprovalData(
        type,
        MOCK_SUBMITTED_PAYLOAD[type],
        DEMO_APPLICANT.name,
        DEMO_APPLICANT.department,
      ),
    [type],
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
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        typeCrumb,
        { label: "전자결재 품의" },
      ]}
      phases={getPhase1Phases(planningType)}
      subSteps={buildPhase1SubSteps("approval", planningType)}
      prevPath={prev?.path}
      prevLabel={prev ? `${prev.label} 다시 보기` : undefined}
      nextPath={next.path}
      nextLabel={next.label}
    >
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
          Datahub에서 작성한 신청서를 기반으로{" "}
          <strong className="font-medium">G Portal 전자결재</strong>에 품의를 작성하고 승인 요청을 진행합니다.
        </span>
      </div>

      {/* 결재선 카드 */}
      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-2 flex items-center gap-1.5">
          <GitBranch size={14} aria-hidden="true" className="text-gray-600 dark:text-gray-300" />
          <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">결재선</h2>
        </header>
        <div className="rounded-md bg-gray-50 px-3 py-2.5 text-[13px] text-gray-800 dark:bg-gray-800/40 dark:text-gray-200">
          신청자의 소속 조직장 전결
        </div>
      </section>

      {/* 통보 대상 카드 */}
      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-2 flex items-center gap-1.5">
          <UsersRound size={14} aria-hidden="true" className="text-gray-600 dark:text-gray-300" />
          <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">통보 대상</h2>
        </header>
        <ul className="flex flex-col gap-1.5">
          {NOTIFY_TARGETS.map((t) => (
            <li
              key={t}
              className="rounded-md bg-gray-50 px-3 py-2 text-[13px] text-gray-800 dark:bg-gray-800/40 dark:text-gray-200"
            >
              {t}
            </li>
          ))}
        </ul>
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

      {toast && (
        <div
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-4 py-2 text-[12px] text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
        >
          {toast}
        </div>
      )}
    </PhaseLayout>
  );
}
