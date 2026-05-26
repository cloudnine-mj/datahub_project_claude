// 진행 이력 가로 타임라인 — 신청 → 담당자 지정 → 수정 → 승인 등 모든 이벤트 누적.
//
//   ┌──────────────────────────────────────────────────────┐
//   │ ⊙ 진행 이력  [4건]                                     │
//   │                                                       │
//   │  ○─────────○─────────○─────────●                       │
//   │  📤        👤        ✏️         ✓                       │
//   │ 신청서 제출  담당자 지정  신청서 수정  승인 완료              │
//   │ 5/18 13:10  5/18 15:40  5/19 09:45  5/19 14:30           │
//   │ 정혜원       김은솔      정혜원       김은솔                │
//   └──────────────────────────────────────────────────────┘
//
// 이벤트 종류:
//   submitted    — 신청서 제출 (#378ADD 파랑)
//   assigned     — 담당자 지정 (#993C1D 갈색)
//   edited       — 신청서 수정 (#BA7517 주황)
//   info_requested — 보완 요청 (#E08027 주황)
//   approved     — 승인 완료 (#1D9E75 녹색)
//
// 마지막(최신) 이벤트는 점이 채워진 형태(채워진 원). 그 외는 테두리만.
// 이벤트가 많아지면 가로 스크롤.

"use client";

import {
  CircleCheck,
  History,
  Pencil,
  Send,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

export type HistoryEventType =
  | "submitted"
  | "assigned"
  | "edited"
  | "info_requested"
  | "approved";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  timestamp: string; // ISO
  actor: string;
}

interface Config {
  label: string;
  icon: LucideIcon;
  color: string;
}

const EVENT_CONFIG: Record<HistoryEventType, Config> = {
  submitted: { label: "신청서 제출", icon: Send, color: "#378ADD" },
  assigned: { label: "담당자 지정", icon: UserCheck, color: "#993C1D" },
  edited: { label: "신청서 수정", icon: Pencil, color: "#BA7517" },
  info_requested: { label: "보완 요청", icon: Pencil, color: "#E08027" },
  approved: { label: "승인 완료", icon: CircleCheck, color: "#1D9E75" },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

export function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) return null;
  const lastIdx = events.length - 1;
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-4 flex items-center gap-2">
        <History
          size={16}
          className="text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          진행 이력
        </h3>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {events.length}건
        </span>
      </header>

      <div className="overflow-x-auto">
        <div
          className="relative flex pt-1"
          style={{ minWidth: events.length > 3 ? "560px" : undefined }}
        >
          {/* 가로 연결선 — 노드 가운데(11px 근처)를 지나도록. */}
          <div
            aria-hidden="true"
            className="absolute left-[10%] right-[10%] top-[7px] h-px bg-gray-200 dark:bg-gray-700"
          />
          {events.map((ev, i) => {
            const cfg = EVENT_CONFIG[ev.type];
            const Icon = cfg.icon;
            const isLast = i === lastIdx;
            return (
              <div
                key={ev.id}
                className="relative z-[1] flex flex-1 flex-col items-center"
              >
                {/* 원형 노드 — 마지막은 채움, 그 외는 테두리만 */}
                <div
                  className="h-[15px] w-[15px] rounded-full border-2"
                  style={{
                    background: isLast ? cfg.color : "var(--color-background-primary, #fff)",
                    borderColor: cfg.color,
                  }}
                  aria-hidden="true"
                />
                <div className="mt-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-[12px] font-medium text-gray-900 dark:text-gray-100">
                    <Icon size={12} style={{ color: cfg.color }} aria-hidden="true" />
                    {cfg.label}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                    {fmtTime(ev.timestamp)}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">
                    {ev.actor}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** approval_history(status 변경 로그) → HistoryEvent[] 변환.
 *  Phase 1: 백엔드 history 의 status / action / comment 를 휴리스틱으로 매핑.
 *    status="submitted"        → submitted
 *    status="reviewing"        → assigned (담당자 검토 시작)
 *    status="info_requested"   → info_requested (보완 요청)
 *    status="approved"         → approved
 *    comment "임시 저장" 포함  → edited (그 외 status 무시)
 *  중복 type 은 누적 (수정 회차마다 새 entry).
 *  changedBy 가 비어있으면 '시스템'. */
export function approvalHistoryToEvents(
  history: { status?: string; action?: string; changedAt?: string; changedBy?: string; comment?: string | null }[] | null,
): HistoryEvent[] {
  if (!history || history.length === 0) return [];
  const out: HistoryEvent[] = [];
  history.forEach((h, i) => {
    if (!h.changedAt) return;
    let type: HistoryEventType | null = null;
    const status = h.status ?? "";
    const action = h.action ?? "";
    const comment = h.comment ?? "";
    if (status === "submitted" && comment.includes("임시 저장")) {
      type = "edited";
    } else if (status === "submitted") {
      type = "submitted";
    } else if (status === "reviewing" || action === "review_started") {
      type = "assigned";
    } else if (status === "info_requested" || action === "info_requested") {
      type = "info_requested";
    } else if (status === "approved" || action === "approved") {
      type = "approved";
    }
    if (!type) return;
    out.push({
      id: `${h.changedAt}-${i}`,
      type,
      timestamp: h.changedAt,
      actor: h.changedBy ?? "시스템",
    });
  });
  return out;
}
