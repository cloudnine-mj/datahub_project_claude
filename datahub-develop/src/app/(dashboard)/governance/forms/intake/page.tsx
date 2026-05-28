// 1. 기획 / substep 2: 요청서 작성 — type/status 자동 해석 client 컴포넌트.
//   1) URL ?type=...&status=... 우선
//   2) 없으면 sessionStorage 의 datahub:planningType (계획 수립 마지막 선택)
//   3) 없으면 저장된 lastFormId 가 있는 유형
//   4) 모두 실패하면 안내 placeholder
//   다른 substep 의 'prev' 가 type 쿼리 없이 진입해도 직전 작성 내용을 그대로 복원.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { PhaseLayout } from "@/components/governance/PhaseLayout";
import { PhaseBlock } from "@/components/governance/PhaseBlock";
import { ApplicationFormContainer } from "@/components/governance/ApplicationForm/ApplicationFormContainer";
import {
  buildPhase1SubSteps,
  getPhase1Phases,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/governance/forms/phase1-substeps";
import type {
  ApplicationStatus,
  ApplicationType,
} from "@/lib/governance/forms/application-config";
import { useApplicationTypeBreadcrumb } from "@/lib/governance/forms/use-application-type-breadcrumb";

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
  // 상세 페이지 '수정' 진입 — 기존 요청서 id 로 프리필해 작성 화면과 동일한 폼을 연다.
  const editFormId = sp?.get("id") ?? null;

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

  const stageType = resolved?.type ?? undefined;
  const prev = prevPhase1Substep("form", stageType);
  const next = nextPhase1Substep("form", stageType);

  const typeCrumb = useApplicationTypeBreadcrumb();

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        typeCrumb,
        { label: editFormId ? "요청서 수정" : "요청서 작성" },
      ]}
      phases={getPhase1Phases(stageType)}
      subSteps={buildPhase1SubSteps("form", stageType)}
    >
      {resolved?.type ? (
        <ApplicationFormContainer
          type={resolved.type}
          initialStatus={resolved.status}
          editFormId={editFormId ?? undefined}
          prevPath={prev?.path}
          nextPath={next.path}
        />
      ) : resolved ? (
        <PhaseBlock icon={FileText} title="요청서 작성">
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
