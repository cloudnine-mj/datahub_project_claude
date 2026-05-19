// 백엔드 ApprovalEntry[] → ProgressHistoryBlock 의 StatusHistoryItem[] 변환.
//   - status → HistoryAction 매핑 (rejected/draft 같은 미지원 status 는 제외)
//   - changed_by 가 submitter_name 과 일치하면 actorRole="신청자", 아니면 "Data Governance Team"
//   - timestamp 는 'M/d HH:mm' 짧은 표기로 변환

import type { ApprovalEntry, FormStatus } from "./types";
import type {
  HistoryAction,
  StatusHistoryItem,
} from "./application-config";

function statusToAction(status: FormStatus): HistoryAction | null {
  if (status === "draft") return "임시 저장";
  if (status === "submitted") return "제출됨";
  if (status === "reviewing") return "검토 시작";
  if (status === "approved") return "승인 완료";
  return null;
}

function isoToShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function approvalHistoryToStatusItems(
  entries: ApprovalEntry[] | null | undefined,
  submitterName?: string,
): StatusHistoryItem[] {
  if (!entries) return [];
  return entries
    .map((e, i): StatusHistoryItem | null => {
      const action = statusToAction(e.status);
      if (!action) return null;
      const isApplicant =
        submitterName && e.changed_by === submitterName ? true : false;
      return {
        id: `srv-${i}-${e.changed_at}`,
        action,
        actor: e.changed_by,
        actorRole: isApplicant ? "신청자" : "Data Governance Team",
        timestamp: isoToShort(e.changed_at),
        comment: e.comment ?? undefined,
      };
    })
    .filter((x): x is StatusHistoryItem => !!x);
}
