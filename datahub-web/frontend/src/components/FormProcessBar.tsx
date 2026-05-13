"use client";

// 신청서 상단 프로세스 진행 바 — IPRS 의 chevron 스타일.
// 현재 데이터 구매 신청(data_purchase) 1종만 지원. 양식별 단계가 모두 달라
// formType 분기로 단계 정의를 따로 둠. 다른 양식으로 확장 시 STEP_DEFS 에 추가.

import { Check, X } from "lucide-react";
import type { FormType } from "@/lib/api";

type StepState = "done" | "current" | "future" | "rejected";

// 양식별 단계 정의. 마지막 단계는 종료 상태(승인 완료 / 반려) — status 에 따라
// 라벨/색이 갈림.
const STEP_DEFS: Partial<Record<FormType, string[]>> = {
  data_purchase: [
    "필요성 정의 및 예산 확인",
    "신청서 작성",
    "전자결재 승인",
    "승인 완료",
  ],
};

export function FormProcessBar({
  formType,
  status,
}: {
  formType: FormType;
  status: string;
}) {
  const steps = STEP_DEFS[formType];
  if (!steps) return null;

  const states = computeStates(status, steps.length);
  const labels = steps.map((label, i) =>
    i === steps.length - 1 && status === "rejected" ? "반려" : label,
  );

  return (
    <div className="my-4 flex items-stretch text-xs font-semibold">
      {labels.map((label, i) => (
        <Chevron
          key={i}
          label={label}
          state={states[i]}
          isFirst={i === 0}
          isLast={i === labels.length - 1}
        />
      ))}
    </div>
  );
}

/** 상태 → 단계별 state 배열. 데이터 구매 4단계 가정.
 *  - draft     : 1✓ / 2● / 3○ / 4○
 *  - submitted / reviewing : 1✓ / 2✓ / 3● / 4○
 *  - approved  : 1✓ / 2✓ / 3✓ / 4✓
 *  - rejected  : 1✓ / 2✓ / 3✓ / 4✗ (라벨도 '반려' 로 교체)
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
  // 알 수 없는 status — 보수적으로 step 2 진행 중으로 표기
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
}: {
  label: string;
  state: StepState;
  isFirst: boolean;
  isLast: boolean;
}) {
  const bg = {
    done: "bg-emerald-500 text-white",
    current: "bg-blue-600 text-white",
    future: "bg-gray-100 text-gray-500",
    rejected: "bg-red-500 text-white",
  }[state];

  // chevron 모양 — first 는 왼쪽 직선 + 오른쪽 뾰족, last 는 왼쪽 노치 + 오른쪽 직선,
  // 가운데 step 은 양쪽 모두 화살표.
  const clipPath = isFirst
    ? `polygon(0 0, calc(100% - ${POINT}) 0, 100% 50%, calc(100% - ${POINT}) 100%, 0 100%)`
    : isLast
    ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${POINT} 50%)`
    : `polygon(0 0, calc(100% - ${POINT}) 0, 100% 50%, calc(100% - ${POINT}) 100%, 0 100%, ${POINT} 50%)`;

  return (
    <div
      className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 ${bg}`}
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
    </div>
  );
}
