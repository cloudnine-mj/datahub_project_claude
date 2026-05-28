// 백엔드 ApprovalEntry[] → ProgressHistoryBlock 의 StatusHistoryItem[] 변환.
//   - 신규 엔트리: action 필드가 있으면 그 값을 우선 사용.
//   - 옛 엔트리: status / comment 휴리스틱 — 같은 status 라도 "보완 요청" 코멘트 prefix
//     로 분기, 이전에 "보완 요청" 이 있었는지에 따라 재제출 / 검토 재개 구분.
//   - snake_case (옛 SQLite) / camelCase (Prisma) 양쪽 호환.

import type { ApprovalEntry, FormStatus } from "./types";
import type {
  HistoryAction,
  StatusHistoryItem,
} from "./application-config";

type ActionCode = NonNullable<ApprovalEntry["action"]>;

const ACTION_CODE_TO_LABEL: Record<ActionCode, HistoryAction> = {
  draft: "임시 저장",
  submitted: "제출됨",
  review_started: "검토 시작",
  info_requested: "보완 요청",
  info_resubmitted: "보완 자료 제출",
  review_resumed: "검토 재개",
  approved: "승인 완료",
};

/** comment 가 [보완 요청] prefix 인지 — 옛 엔트리 휴리스틱용. */
function commentLooksLikeInfoRequest(comment: string | null | undefined): boolean {
  if (!comment) return false;
  return /^\s*\[보완\s*요청\]/.test(comment);
}

/** status + 이전 이력에 따라 액션 라벨을 결정하는 휴리스틱 (action 필드 없는 옛 엔트리). */
function heuristicAction(
  status: FormStatus,
  comment: string | null | undefined,
  hadPriorInfoRequest: boolean,
): HistoryAction | null {
  if (status === "draft") return "임시 저장";
  if (status === "approved") return "승인 완료";
  if (status === "info_requested") return "보완 요청";
  if (commentLooksLikeInfoRequest(comment)) return "보완 요청";
  if (status === "submitted") return hadPriorInfoRequest ? "보완 자료 제출" : "제출됨";
  if (status === "reviewing") return hadPriorInfoRequest ? "검토 재개" : "검토 시작";
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
  let hadPriorInfoRequest = false;
  const out: StatusHistoryItem[] = [];
  entries.forEach((e, i) => {
    const explicit = e.action ? ACTION_CODE_TO_LABEL[e.action] : undefined;
    const action: HistoryAction | null =
      explicit ?? heuristicAction(e.status, e.comment, hadPriorInfoRequest);
    if (!action) return;
    const actor = e.changedBy ?? e.changed_by ?? "";
    const at = e.changedAt ?? e.changed_at ?? "";
    const isApplicant = !!(submitterName && actor === submitterName);
    out.push({
      id: `srv-${i}-${at}`,
      action,
      actor,
      actorRole: isApplicant ? "신청자" : "Data Governance Team",
      timestamp: isoToShort(at),
      at,
      comment: e.comment ?? undefined,
    });
    if (action === "보완 요청") hadPriorInfoRequest = true;
  });
  return out;
}
