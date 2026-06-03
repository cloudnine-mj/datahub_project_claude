// 진행 단계(3/4) 상세 탭 — 용역 제작(data_production) 본문.
//
// 레이아웃(위→아래):
//   1) 안내 카드  2) 수령 데이터 카드(전체 폭)  3) 피드백 이력 카드(전체 폭)
//   4) 60:40 그리드
//       좌측: 신청 정보(접힘) / 협의 결과(접힘) / 최신 데이터 검토 카드(품질 확인 분기)
//       우측: 채팅 패널(absolute 트릭으로 좌측 높이에 맞춤)
//
// Phase 1: sessionStorage 기반. 권한 분기 없음.

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRightCircle, ChevronDown, CircleCheck, Lock } from "lucide-react";
import { api, type FormDetail } from "@/lib/governance/api-client-full";
import { getChatAssignee } from "@/lib/governance/chat-assignee";
import {
  appendFeedback,
  deliveryShortLabel,
  readReceivedData,
  setReceivedStatus,
  writeProgressState,
  type DeliveryRound,
  type FeedbackAttachmentMeta,
  type ReceivedDataItem,
} from "@/lib/governance/progress-storage";
import { ReceivedDataCard } from "./progress/ReceivedDataCard";
import { UploadDataModal } from "./progress/UploadDataModal";
import { FeedbackHistoryCard } from "./progress/FeedbackHistoryCard";
import { LatestDataReviewCard } from "./progress/LatestDataReviewCard";
import {
  FeedbackComposeModal,
  type FeedbackTarget,
} from "./progress/FeedbackComposeModal";

interface Props {
  formId: string;
  form: FormDetail;
  /** 신청 정보 표(헤더 제외) — 부모가 만든 표를 접힘 카드 본문으로 재사용. */
  requestInfoTable: ReactNode;
  /** 우측 채팅 패널. */
  chatPanel: ReactNode;
  /** 이력 변경 후 부모가 폼을 다시 불러오도록 알림. */
  onActivity?: () => void;
}

export function ProgressStageTab({
  formId,
  form,
  requestInfoTable,
  chatPanel,
  onActivity,
}: Props) {
  const lead = useMemo(() => getChatAssignee(), []);
  const [uploadOpen, setUploadOpen] = useState(false);
  // 피드백 작성 모달 — null 이면 닫힘. initialTarget 으로 진입 시 대상 자동 선택.
  const [composeTarget, setComposeTarget] = useState<FeedbackTarget | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [received, setReceived] = useState<ReceivedDataItem[]>([]);

  useEffect(() => {
    function refresh(): void {
      setReceived(readReceivedData(formId));
    }
    refresh();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ formId?: string }>).detail;
      if (!detail || detail.formId === formId) refresh();
    };
    window.addEventListener("dh:gov:progress-changed", onChange);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("dh:gov:progress-changed", onChange);
      window.removeEventListener("focus", refresh);
    };
  }, [formId]);

  // 가장 최근 업로드(시각 기준) = 최신 데이터.
  const latest = useMemo<ReceivedDataItem | null>(() => {
    if (received.length === 0) return null;
    let it = received[0];
    received.forEach((x) => {
      if (x.uploadedAt > it.uploadedAt) it = x;
    });
    return it;
  }, [received]);

  // 진행 단계 액션은 모두 채팅 시스템 메시지로 알린다(페이지 안 알림 박스 없음).
  //   ChatPanel 은 focus 이벤트로 재조회 — 같은 화면 즉시 갱신 유도.
  function notifyChat(text: string): void {
    api
      .createFormMessage(formId, text)
      .then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("focus"));
        }
        onActivity?.();
      })
      .catch(() => {
        /* ignore */
      });
  }

  function onUploaded(round: DeliveryRound, version: number): void {
    // 진행 단계 진척 상태 갱신 — 해당 납품이 시작/진행 중인 것을 반영.
    if (round === "final") {
      writeProgressState(formId, { finalReviewing: true });
    }
    notifyChat(`[${lead.name}]님이 ${deliveryShortLabel(round)} v${version} 데이터를 업로드했습니다.`);
  }

  // [확인 완료] (중간/수정) — status 갱신 + 진척 완료 + 채팅 알림.
  function onConfirm(item: ReceivedDataItem): void {
    setReceivedStatus(formId, item.id, "confirmed");
    if (item.deliveryRound === "middle") {
      writeProgressState(formId, { middleCompleted: true });
    } else if (item.deliveryRound === "modified") {
      writeProgressState(formId, { modifiedCompleted: true });
    }
    notifyChat(`[${lead.name}]님이 [${deliveryShortLabel(item.deliveryRound)} v${item.version}]를 확인 완료했습니다.`);
  }

  // [문제 없음 → 종료 절차] (최종) — 양식 모달 흐름은 별도 작업. Phase 1: alert + 채팅 알림.
  function onNoIssue(item: ReceivedDataItem): void {
    if (typeof window !== "undefined") {
      window.alert(
        "[Phase 1] 양식 모달(수령·품질확인서)은 별도 작업으로 분리됩니다. 임시: 종료 절차 시작.",
      );
    }
    setReceivedStatus(formId, item.id, "confirmed");
    writeProgressState(formId, { closureStarted: true });
    notifyChat(`[${lead.name}]님이 최종 데이터 품질을 확정했습니다.`);
  }

  // 피드백 작성 모달 열기 — 대상 자동 선택(없으면 '일반').
  function openCompose(target: FeedbackTarget | null): void {
    setComposeTarget(target);
    setComposeOpen(true);
  }

  function onSubmitFeedback(payload: {
    targetDeliveryRound: DeliveryRound | null;
    targetVersion: number | null;
    content: string;
    attachments: FeedbackAttachmentMeta[];
  }): void {
    appendFeedback(formId, {
      targetDeliveryRound: payload.targetDeliveryRound,
      targetVersion: payload.targetVersion,
      content: payload.content || undefined,
      attachments: payload.attachments,
      author: lead.name,
    });
    const label =
      payload.targetDeliveryRound && payload.targetVersion
        ? `'${deliveryShortLabel(payload.targetDeliveryRound)} v${payload.targetVersion}'에 대한 `
        : "";
    notifyChat(`[${lead.name}]님이 ${label}피드백을 작성했습니다.`);
    setComposeOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <InfoCard />

      <ReceivedDataCard formId={formId} onUploadClick={() => setUploadOpen(true)} />

      <FeedbackHistoryCard formId={formId} onCompose={() => openCompose(null)} />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[60fr_40fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <CollapsibleSection title="신청 정보" approved>
            {requestInfoTable}
          </CollapsibleSection>

          <CollapsibleSection title="최종 협의 내용 · 계약 정보" locked>
            <p className="text-[11px] text-[var(--color-text-tertiary,#9ca3af)]">
              협의 및 계약 단계에서 잠금된 내용입니다. 펼침 시 표시되며, 이 단계에서는 수정 불가.
            </p>
          </CollapsibleSection>

          <LatestDataReviewCard
            latest={latest}
            onConfirm={onConfirm}
            onNoIssue={onNoIssue}
            onRequestFeedback={(item) =>
              openCompose({ deliveryRound: item.deliveryRound, version: item.version })
            }
          />
        </div>

        <div className="relative min-h-[480px]">
          <div className="absolute inset-0">{chatPanel}</div>
        </div>
      </div>

      {uploadOpen && (
        <UploadDataModal
          formId={formId}
          uploader={lead.name}
          onClose={() => setUploadOpen(false)}
          onUploaded={onUploaded}
        />
      )}

      {composeOpen && (
        <FeedbackComposeModal
          received={received}
          initialTarget={composeTarget ?? undefined}
          onClose={() => setComposeOpen(false)}
          onSubmit={onSubmitFeedback}
        />
      )}
    </div>
  );
}

/** 안내 카드 — 제목 없이 본문만(협의 단계와 동일 톤). */
function InfoCard() {
  return (
    <section
      className="flex items-start gap-2.5 rounded-xl p-4"
      style={{ background: "#FCF3F0", border: "0.5px solid #EFC4B9" }}
    >
      <ArrowRightCircle
        size={18}
        aria-hidden="true"
        className="mt-px shrink-0 text-[#D4533E]"
      />
      <p className="text-[11px] text-[#993C1D]" style={{ lineHeight: 1.7 }}>
        메일·SharePoint로 받은 데이터를 업로드해 주세요. 데이터는 납품 단위로 누적되며, 피드백은 표 자산으로 기록됩니다. 품질 확인 후 [문제 없음] → 종료 절차로 넘어갑니다.
      </p>
    </section>
  );
}

/** 접힘 카드 — 신청 정보 / 협의·계약 결과 등에 공용. */
function CollapsibleSection({
  title,
  approved,
  locked,
  children,
}: {
  title: string;
  approved?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="flex items-center gap-1.5">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {approved && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <CircleCheck size={11} aria-hidden="true" /> 승인 완료
          </span>
        )}
        {locked && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <Lock size={11} aria-hidden="true" /> 완료 (잠금)
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {open ? "접기" : "펼쳐 보기"}
          <ChevronDown
            size={13}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </header>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}
