// 신청서 상태별 안내 배너.
//   draft: HelpBanner 재사용 (brand red)
//   submitted / reviewing: warning (amber) — 수정 불가 안내
//   approved: 표시 안 함

import { Lock } from "lucide-react";
import { HelpBanner } from "@/components/HelpBanner";
import type { ApplicationStatus } from "@/lib/applicationFormConfig";

interface Props {
  status: ApplicationStatus;
}

export function StatusBanner({ status }: Props) {
  if (status === "approved") return null;

  if (status === "draft") {
    return (
      <HelpBanner message="신청서는 전자결재 및 업무 소통용으로 사용됩니다. Datahub에서 작성합니다." />
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>
        신청서가 제출되어 검토 중입니다. 수정하려면 신청을 취소하고 다시 작성해야 합니다.
      </p>
    </div>
  );
}
