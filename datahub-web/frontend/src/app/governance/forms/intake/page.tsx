// 1. 기획 / substep 2: 신청서 작성 — type/status 자동 해석 client 컴포넌트.
//   1) URL ?type=...&status=... 우선
//   2) 없으면 sessionStorage 의 datahub:planningType (계획 수립 마지막 선택)
//   3) 없으면 저장된 lastFormId 가 있는 유형
//   4) 모두 실패하면 안내 placeholder
//   다른 substep 의 'prev' 가 type 쿼리 없이 진입해도 직전 작성 내용을 그대로 복원.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { PhaseLayout } from "@/components/PhaseLayout";
import { PhaseBlock } from "@/components/PhaseBlock";
import { ApplicationFormContainer } from "@/components/ApplicationForm/ApplicationFormContainer";
import {
  PHASE1_PHASES,
  buildPhase1SubSteps,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/phase1Substeps";
import type {
  ApplicationStatus,
  ApplicationType,
} from "@/lib/applicationFormConfig";

const ALL_TYPES: ApplicationType[] = ["service", "purchase", "subscribe"];

function isType(v: string | null | undefined): v is ApplicationType {
  return v === "service" || v === "purchase" || v === "subscribe";
}

function isStatus(v: string | null | undefined): v is ApplicationStatus {
  return v === "draft" || v === "submitted" || v === "reviewing" || v === "approved";
}

function resolveTypeFromSession(): ApplicationType | null {
  if (typeof window === "undefined") return null;
  const planned = sessionStorage.getItem("datahub:planningType");
  if (isType(planned)) return planned;
  for (const t of ALL_TYPES) {
    if (sessionStorage.getItem(`datahub:lastFormId:${t}`)) return t;
  }
  return null;
}

export default function Page() {
  const sp = useSearchParams();
  const urlType = sp?.get("type") ?? null;
  const urlStatus = sp?.get("status") ?? null;

  const prev = prevPhase1Substep("form");
  const next = nextPhase1Substep("form");

  // SSR 단계에서는 sessionStorage 접근 불가 — 마운트 후 한 번 해석.
  const [resolved, setResolved] = useState<{
    type: ApplicationType | null;
    status: ApplicationStatus;
  } | null>(null);

  useEffect(() => {
    const t = isType(urlType) ? urlType : resolveTypeFromSession();
    const s = isStatus(urlStatus) ? urlStatus : "draft";
    setResolved({ type: t, status: s });
  }, [urlType, urlStatus]);

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
        { label: "1. 기획 · 신청서 작성" },
      ]}
      phases={PHASE1_PHASES}
      subSteps={buildPhase1SubSteps("form")}
    >
      {resolved?.type ? (
        <ApplicationFormContainer
          type={resolved.type}
          initialStatus={resolved.status}
          prevPath={prev?.path}
          nextPath={next.path}
        />
      ) : resolved ? (
        <PhaseBlock icon={FileText} title="신청서 작성">
          <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            계획 수립 단계에서 신청 유형을 선택한 뒤 다시 진입해 주세요.
          </p>
          <div className="rounded-lg bg-gray-50 px-4 py-10 text-center dark:bg-gray-800/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">신청 유형별 양식 영역</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              (구매/구독/용역 각각의 양식이 표시되는 자리)
            </p>
          </div>
        </PhaseBlock>
      ) : null}
    </PhaseLayout>
  );
}
