// 진행 이력 가로 타임라인 — 신청 단계 흐름의 모든 이벤트 누적 표시.
//
//   ┌──────────────────────────────────────────────────────────┐
//   │ ⊙ 진행 이력  [4건]                                          │
//   │                                                            │
//   │  ○──────────●──────────●──────────●                         │
//   │ [신청서 제출]  [담당자 지정]  [승인 요청]  [승인 완료]            │
//   │ [검토 시작]                                                  │
//   │ 5/28 13:43   5/28 14:10   5/28 14:55   5/28 15:12            │
//   │              김은솔(총괄)   강민정(신청자) 김은솔(총괄)          │
//   └──────────────────────────────────────────────────────────┘
//
// - 제출(submitted) + 검토 시작(review_started) 은 한 노드로 병합 (제출=검토 개시).
// - 채팅 논의는 이력 이벤트가 아니다 (채팅 메시지로만 기록).
// - 같은 이벤트가 여러 번이면 라벨에 'N차' 자동 부여.
// - 최신(마지막) 노드는 색 링으로 강조.

"use client";

import {
  ArrowRightCircle,
  CircleCheck,
  Eye,
  History,
  Pencil,
  Send,
  SendHorizontal,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type HistoryEventType =
  | "submitted"
  | "review_started"
  | "member_assigned"
  | "revision"
  | "approval_requested"
  | "approved"
  | "info_requested"
  | "stage_transition";

export type ActorRole = "applicant" | "lead" | "member" | "system";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  timestamp: string; // ISO
  actor: string;
  actorRole?: ActorRole;
}

interface Config {
  label: string;
  icon: LucideIcon;
  /** 원형 노드 색 */
  node: string;
  /** 칩 배경 / 텍스트 색 */
  chipBg: string;
  chipText: string;
}

const EVENT_CONFIG: Record<HistoryEventType, Config> = {
  submitted: { label: "신청서 제출", icon: Send, node: "#378ADD", chipBg: "#E6F1FB", chipText: "#0C447C" },
  review_started: { label: "검토 시작", icon: Eye, node: "#BA7517", chipBg: "#FAEEDA", chipText: "#854F0B" },
  member_assigned: { label: "담당자 지정", icon: UserPlus, node: "#993C1D", chipBg: "#FAECE7", chipText: "#993C1D" },
  revision: { label: "신청서 수정", icon: Pencil, node: "#BA7517", chipBg: "#FAEEDA", chipText: "#854F0B" },
  approval_requested: { label: "승인 요청", icon: SendHorizontal, node: "#BA7517", chipBg: "#FAEEDA", chipText: "#854F0B" },
  approved: { label: "승인 완료", icon: CircleCheck, node: "#1D9E75", chipBg: "#E1F5EE", chipText: "#0F6E56" },
  info_requested: { label: "보완 요청", icon: Pencil, node: "#E08027", chipBg: "#FBEBD6", chipText: "#B5610F" },
  stage_transition: { label: "계약 단계 전환", icon: ArrowRightCircle, node: "#D4533E", chipBg: "#FCEAE5", chipText: "#993C1D" },
};

const ROLE_LABEL: Record<ActorRole, string> = {
  applicant: "신청자",
  lead: "총괄",
  member: "담당자",
  system: "",
};

/** actorRole 미저장 옛 엔트리 대비 — 이벤트 타입으로 주체 역할 추정. */
function roleForType(type: HistoryEventType): ActorRole {
  if (
    type === "member_assigned" ||
    type === "approved" ||
    type === "info_requested" ||
    type === "stage_transition"
  ) {
    return "lead";
  }
  if (type === "review_started") return "system";
  return "applicant";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

function actorText(ev: HistoryEvent): string {
  const role = ev.actorRole ?? roleForType(ev.type);
  if (role === "system") return "";
  if (!ev.actor) return "";
  const roleLabel = ROLE_LABEL[role];
  return roleLabel ? `${ev.actor}(${roleLabel})` : ev.actor;
}

interface MergedNode {
  primary: HistoryEvent;
  /** 제출 직후 검토 시작처럼 같은 노드에 묶이는 보조 이벤트. */
  secondary?: HistoryEvent;
}

function EventChip({ type, label }: { type: HistoryEventType; label: string }) {
  const cfg = EVENT_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: cfg.chipBg, color: cfg.chipText }}
    >
      <Icon size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

export function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) return null;

  // 타입별 총 개수 — 2건 이상이면 'N차' 표기.
  const typeCounts: Record<string, number> = {};
  events.forEach((e) => {
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  });
  const typeSeen: Record<string, number> = {};
  const labelFor = (type: HistoryEventType): string => {
    const base = EVENT_CONFIG[type].label;
    if ((typeCounts[type] ?? 0) <= 1) return base;
    typeSeen[type] = (typeSeen[type] ?? 0) + 1;
    return `${base} ${typeSeen[type]}차`;
  };

  // 병합 — submitted 바로 뒤 review_started 는 한 노드로 묶음.
  const nodes: MergedNode[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const next = events[i + 1];
    if (ev.type === "submitted" && next && next.type === "review_started") {
      nodes.push({ primary: ev, secondary: next });
      i++;
    } else {
      nodes.push({ primary: ev });
    }
  }

  const lastIdx = nodes.length - 1;

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-4 flex items-center gap-2">
        <History size={16} className="text-gray-500 dark:text-gray-400" aria-hidden="true" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">진행 이력</h3>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {events.length}건
        </span>
      </header>

      <div className="overflow-x-auto">
        <div
          className="relative grid pt-1"
          style={{
            gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))`,
            minWidth: nodes.length > 3 ? `${nodes.length * 150}px` : undefined,
          }}
        >
          {/* 가로 연결선 — 노드 가운데를 지나도록. */}
          <div
            aria-hidden="true"
            className="absolute left-[10%] right-[10%] top-[7px] h-px bg-gray-200 dark:bg-gray-700"
          />
          {nodes.map((node, i) => {
            const cfg = EVENT_CONFIG[node.primary.type];
            const isLast = i === lastIdx;
            const primaryLabel = labelFor(node.primary.type);
            const secondaryLabel = node.secondary ? labelFor(node.secondary.type) : null;
            const actor = actorText(node.primary);
            return (
              <div key={node.primary.id} className="relative z-[1] flex flex-col items-center">
                {/* 원형 노드 — 마지막은 채움 + 색 링 강조, 그 외는 테두리만 */}
                <div
                  className="h-[15px] w-[15px] rounded-full border-2"
                  style={{
                    background: isLast ? cfg.node : "var(--color-background-primary, #fff)",
                    borderColor: cfg.node,
                    boxShadow: isLast ? `0 0 0 4px ${cfg.node}33` : undefined,
                  }}
                  aria-hidden="true"
                />
                <div className="mt-3 flex flex-col items-center gap-1 text-center">
                  <EventChip type={node.primary.type} label={primaryLabel} />
                  {node.secondary && secondaryLabel && (
                    <EventChip type={node.secondary.type} label={secondaryLabel} />
                  )}
                </div>
                <div className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                  {fmtTime(node.primary.timestamp)}
                </div>
                {actor && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">{actor}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** 명시적 action 코드 → 타임라인 이벤트 타입.
 *  백엔드(events route / form POST·PATCH) 가 기록하는 action 을 단일 진실로 사용. */
const ACTION_TO_TYPE: Record<string, HistoryEventType> = {
  submitted: "submitted",
  review_started: "review_started",
  review_resumed: "review_started",
  member_assigned: "member_assigned",
  assigned: "member_assigned",
  edited: "revision",
  revision: "revision",
  approval_requested: "approval_requested",
  info_resubmitted: "revision",
  info_requested: "info_requested",
  approved: "approved",
  stage_transition: "stage_transition",
};

function isActorRole(v: unknown): v is ActorRole {
  return v === "applicant" || v === "lead" || v === "member" || v === "system";
}

/** approval_history(진행 이력 로그) → HistoryEvent[] 변환.
 *  - action 코드가 있으면 그대로 매핑.
 *  - action 이 없는 옛 엔트리는 status / comment 휴리스틱으로 fallback.
 *  - draft(임시 저장) 단독 엔트리는 타임라인에 노출하지 않음.
 *
 *  ApprovalEntry 는 camelCase / snake_case 둘 다 허용 — 두 표기 모두 fallback 처리. */
export function approvalHistoryToEvents(
  history:
    | {
        status?: string;
        action?: string;
        changedAt?: string;
        changed_at?: string;
        changedBy?: string;
        changed_by?: string;
        comment?: string | null;
        actorRole?: string;
        actor_role?: string;
      }[]
    | null,
): HistoryEvent[] {
  if (!history || history.length === 0) return [];
  const out: HistoryEvent[] = [];
  history.forEach((h, i) => {
    const changedAt = h.changedAt ?? h.changed_at;
    if (!changedAt) return;
    const changedBy = h.changedBy ?? h.changed_by ?? "시스템";
    const status = h.status ?? "";
    const action = h.action ?? "";
    const comment = h.comment ?? "";
    const roleRaw = h.actorRole ?? h.actor_role;

    let type: HistoryEventType | null = null;
    if (action && ACTION_TO_TYPE[action]) {
      type = ACTION_TO_TYPE[action];
    } else if (status === "submitted" && comment.includes("임시 저장")) {
      type = "revision"; // 옛 데이터 호환
    } else if (status === "submitted") {
      type = "submitted";
    } else if (status === "reviewing") {
      type = "review_started";
    } else if (status === "info_requested") {
      type = "info_requested";
    } else if (status === "approved") {
      type = "approved";
    }
    if (!type) return;
    out.push({
      id: `${changedAt}-${i}`,
      type,
      timestamp: changedAt,
      actor: changedBy,
      actorRole: isActorRole(roleRaw) ? roleRaw : undefined,
    });
  });
  return out;
}
