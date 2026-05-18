// API 활용 계획서 · 1단계 기획 · 전자결재 품의.
//   결재선(신청자 소속 조직장 전결) + 통보 대상 + G Portal 진행 안내(품의서 가이드 표)
//   + 액션 버튼.
//   - 비용부서/프로젝트: 지급수수료-API 고정
//   - [결재 본문 복사] → ApprovalCopyModal 재사용
//   - [G Portal 전자결재로 이동] → 외부 링크
//   - 하단 [← 신청서 작성 다시 보기] / [2단계 운영으로 진행 →]

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  ListChecks,
  Route,
  UsersRound,
} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ApiProcessStepper } from "@/components/ApiProcess/ApiProcessStepper";
import { HelpBanner } from "@/components/HelpBanner";
import { ApprovalCopyModal } from "@/components/ApplicationForm/ApprovalCopyModal";
import { buildApiApprovalData } from "@/lib/apiApprovalData";

const G_PORTAL_URL = "https://gportal.lgresearch.ai/portal/main/portalMain.do";

const NOTIFY_TARGETS = [
  "AI Biz. Development Team장 (박용민)",
  "Data Governance Team장 (김의순)",
  "Data Governance Team 실무자 (김은솔)",
];

// 데모용 신청서 데이터 — 실 폼이 생기면 storage / API 에서 로드.
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
  const [copyOpen, setCopyOpen] = useState(false);
  const projectName = DEMO_FORM.projectName;

  const openGPortal = () => {
    window.open(G_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "API 활용 계획서", href: "/governance/api-applications/planning" },
          { label: "1. 기획 · 전자결재 품의" },
        ]}
      />

      <ApiProcessStepper currentSubstep="approval" />

      <HelpBanner message="Datahub에서 작성한 신청서를 기반으로 G Portal 전자결재에 품의를 작성하고 승인 요청을 진행합니다." />

      {/* 결재선 카드 */}
      <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-2 flex items-center gap-1.5">
          <Route size={14} aria-hidden="true" className="text-gray-600 dark:text-gray-300" />
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

      {/* G Portal 진행 카드 */}
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
          G Portal 전자결재에서 품의를 작성하고 승인 요청해 주세요.
        </p>

        {/* 품의서 작성 가이드 */}
        <div className="mb-3 rounded-lg bg-gray-50 px-3.5 py-3 dark:bg-gray-800/40">
          <div className="mb-2.5 flex items-center gap-1.5">
            <ListChecks
              size={13}
              aria-hidden="true"
              className="text-gray-600 dark:text-gray-300"
            />
            <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
              품의서 작성 가이드
            </span>
          </div>
          <table className="w-full border-collapse">
            <tbody>
              <GuideRow label="품의유형" value="일반 품의" />
              <GuideRow
                label="제목"
                value={
                  <>
                    API 활용 신청 —{" "}
                    {projectName ? (
                      projectName
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        {"{프로젝트명}"}
                      </span>
                    )}
                  </>
                }
              />
              <GuideRow
                label="비용부서/프로젝트"
                value="신청자 소속 조직 / 지급수수료-API"
              />
              <GuideRow
                label="내역"
                noBorder
                value={
                  <span className="text-blue-700 dark:text-blue-300">
                    Datahub에서 복사한 결재 본문을 붙여 넣기
                  </span>
                }
              />
            </tbody>
          </table>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCopyOpen(true)}
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
          신청서 작성 다시 보기
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

      {copyOpen && (
        <ApprovalCopyModal
          data={buildApiApprovalData(DEMO_APPLICANT, DEMO_FORM)}
          onClose={() => setCopyOpen(false)}
          onProceedNext={() => {
            setCopyOpen(false);
            router.push("/governance/api-applications/operate");
          }}
        />
      )}
    </div>
  );
}

function GuideRow({
  label,
  value,
  noBorder,
}: {
  label: string;
  value: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <tr
      className={
        noBorder
          ? ""
          : "border-b border-gray-200 dark:border-gray-700"
      }
    >
      <th
        scope="row"
        className="w-[140px] py-2 pr-3 text-left text-[11px] font-normal text-gray-500 dark:text-gray-400"
      >
        {label}
      </th>
      <td className="py-2 text-[12px] text-gray-900 dark:text-gray-100">{value}</td>
    </tr>
  );
}
