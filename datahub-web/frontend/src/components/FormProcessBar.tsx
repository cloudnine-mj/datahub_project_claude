"use client";

// 신청서 상단 프로세스 진행 바 — IPRS 의 chevron 스타일.
// 각 chevron 클릭 시 단계 설명 패널이 펼쳐짐(같은 단계 다시 클릭하면 닫힘).
// 현재 데이터 구매 신청(data_purchase) 1종만 지원. 양식별 단계/설명이 모두
// 달라 formType 분기로 정의를 따로 둠. 다른 양식으로 확장 시 STEP_DEFS 와
// STEP_GUIDES 양쪽에 추가.

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { FormType } from "@/lib/api";

type StepState = "done" | "current" | "future" | "rejected";

interface StepDef {
  label: string;
  /** 클릭 시 부드럽게 스크롤할 대상 CSS selector. 단계 설명 패널 + 스크롤이 같이 일어남. */
  scrollTo?: string;
}

const STEP_DEFS: Partial<Record<FormType, StepDef[]>> = {
  data_purchase: [
    { label: "필요성 정의 및 예산 확인" },
    { label: "신청서 작성", scrollTo: "#form-content" },
    { label: "승인 완료" },
    { label: "전자결재 승인" },
  ],
};

// 단계 클릭 시 펼쳐질 설명 — LG 자료 원문 기반.
const STEP_GUIDES: Partial<Record<FormType, string[][]>> = {
  data_purchase: [
    [
      "신청자는 구매 대상 데이터, 데이터 구매 목적, 활용 범위, 필요 기간 등을 정의합니다.",
      "신청자는 데이터 구매 예산과 구매 비용을 확인합니다.",
    ],
    [
      "신청자는 데이터 구매 신청서를 작성하여 G Portal 전자결재 시스템에 첨부 후, 조직장의 승인을 받습니다.",
      "본 화면 하단의 양식 폼이 G Portal 첨부용 신청서입니다 — '미리보기' 로 표 형태 HTML 을 복사할 수 있습니다.",
    ],
    [],
    [
      "결재선: 신청자의 소속 조직장",
      "통보: AI Biz. Development Team장(박용민), Data Governance Team장(김의순), Data Governance Team 실무자(김은솔)",
      "조직장 결재 승인 후 데이터 구매가 진행됩니다.",
      "통보 대상자에게 결과가 자동 안내됩니다.",
    ],
  ],
};

export function FormProcessBar({
  formType,
  status,
  onSelectedStepChange,
}: {
  formType: FormType;
  status: string;
  /** 선택된 step 변화를 부모에 알림 — 부모는 step 에 따라 다른 영역을 숨기거나 강조할 수 있음. */
  onSelectedStepChange?: (step: number | null) => void;
}) {
  const steps = STEP_DEFS[formType];
  const guides = STEP_GUIDES[formType];
  const [selected, setSelected] = useState<number | null>(null);
  if (!steps) return null;

  function updateSelected(next: number | null) {
    setSelected(next);
    onSelectedStepChange?.(next);
  }

  const states = computeStates(status, steps.length);
  const labels = steps.map((s, i) =>
    i === steps.length - 1 && status === "rejected" ? "반려" : s.label,
  );

  function handleClick(i: number) {
    const next = selected === i ? null : i;
    updateSelected(next);
    const target = steps?.[i].scrollTo;
    if (next !== null && target) {
      // 패널 토글 + 컨텐츠 마운트 직후 안정화 위해 한 틱 뒤 스크롤
      setTimeout(() => {
        document
          .querySelector(target)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }

  return (
    <div className="my-4">
      <div className="flex items-stretch text-xs font-semibold">
        {labels.map((label, i) => (
          <Chevron
            key={i}
            label={label}
            state={states[i]}
            isFirst={i === 0}
            isLast={i === labels.length - 1}
            selected={selected === i}
            onClick={() => handleClick(i)}
          />
        ))}
      </div>

      {selected !== null && guides && guides[selected] && guides[selected].length > 0 && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50/60 px-5 py-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              {selected + 1}. {labels[selected]}
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="설명 닫기"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-1.5 text-gray-700">
            {guides[selected].map((line, j) => (
              <li key={j} className="flex gap-2">
                <span className="shrink-0 text-gray-400">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 상태 → 단계별 state 배열. 데이터 구매 4단계 가정 (3·4 단계 위치 스왑됨).
 *  - draft     : 1✓ / 2● / 3○ / 4○
 *  - submitted / reviewing : 1✓ / 2✓ / 3● / 4○ (승인 진행 중)
 *  - approved  : 1✓ / 2✓ / 3✓ / 4✓
 *  - rejected  : 1✓ / 2✓ / 3✓ / 4✗ (마지막 단계 '반려' 로 교체)
 */
function computeStates(status: string, length: number): StepState[] {
  const arr: StepState[] = Array(length).fill("future");
  if (status === "draft") {
    arr[0] = "done";
    arr[1] = "current";
    return arr;
  }
  if (status === "submitted" || status === "reviewing") {
    arr[0] = "done";
    arr[1] = "done";
    arr[2] = "current";
    return arr;
  }
  if (status === "approved") {
    return arr.map(() => "done");
  }
  if (status === "rejected") {
    arr[0] = "done";
    arr[1] = "done";
    arr[2] = "done";
    arr[length - 1] = "rejected";
    return arr;
  }
  arr[0] = "done";
  arr[1] = "current";
  return arr;
}

const POINT = "0.9rem";

function Chevron({
  label,
  state,
  isFirst,
  isLast,
  selected,
  onClick,
}: {
  label: string;
  state: StepState;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const bg = {
    done: "bg-emerald-500 text-white hover:bg-emerald-600",
    current: "bg-blue-600 text-white hover:bg-blue-700",
    future: "bg-gray-100 text-gray-500 hover:bg-gray-200",
    rejected: "bg-red-500 text-white hover:bg-red-600",
  }[state];

  // chevron 모양 — first 는 왼쪽 직선 + 오른쪽 뾰족, last 는 왼쪽 노치 + 오른쪽 직선,
  // 가운데 step 은 양쪽 모두 화살표.
  const clipPath = isFirst
    ? `polygon(0 0, calc(100% - ${POINT}) 0, 100% 50%, calc(100% - ${POINT}) 100%, 0 100%)`
    : isLast
    ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${POINT} 50%)`
    : `polygon(0 0, calc(100% - ${POINT}) 0, 100% 50%, calc(100% - ${POINT}) 100%, 0 100%, ${POINT} 50%)`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2.5 font-semibold transition ${bg} ${selected ? "brightness-110 saturate-150" : ""}`}
      style={{
        clipPath,
        paddingLeft: isFirst ? "0.75rem" : `calc(0.75rem + ${POINT})`,
        paddingRight: isLast ? "0.75rem" : `calc(0.75rem + ${POINT})`,
        marginLeft: isFirst ? 0 : `-${POINT}`,
      }}
    >
      {state === "done" && <Check size={12} strokeWidth={3} />}
      {state === "rejected" && <X size={12} strokeWidth={3} />}
      <span className="truncate">{label}</span>
    </button>
  );
}
