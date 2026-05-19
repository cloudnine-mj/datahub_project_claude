// API 활용 계획서 · 1단계 기획 · 계획 수립 substep.
//   페이지 헤더 + ApiProcessStepper + 안내 배너 + 사전 품의서 라디오 +
//   좌우 분할(검토 사항 / 작성 예시) + 예산 체크박스 + 하단 액션.
//   필수 항목: 사전 품의서 옵션 선택 + 예산 필수 3 체크. 모두 충족해야 [신청서 작성으로] 활성.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Coins,
  FileSearch,
  Lightbulb,
  ListChecks,
  Plug,
} from "lucide-react";
import { ApiProcessStepper } from "@/components/ApiProcess/ApiProcessStepper";
import { HelpBanner } from "@/components/HelpBanner";

type ApprovalExistence = "exists" | "not-exists" | null;

interface BudgetCheckState {
  budgetConfirmed: boolean;
  cardAvailable: boolean;
  costCenterUnderstood: boolean;
  managerReported: boolean;
}

const CHECKLIST = [
  "활용할 API 종류와 제공사",
  "연관 프로젝트",
  "API 사용 목적",
  "사용 기간",
  "예상 비용 (월 평균·총액)",
];

const EXAMPLES: Array<{ label: string; value: string }> = [
  { label: "활용 API", value: "Anthropic Claude API, OpenAI GPT-4 API" },
  { label: "연관 프로젝트", value: "2026 고객 행동 분석 플랫폼 구축" },
  {
    label: "사용 목적",
    value: "LLM 기반 리포트 자동 생성 및 데이터 분석 워크플로우 효율화",
  },
  { label: "사용 기간", value: "2026-07-01 ~ 2026-12-31 (6개월)" },
  { label: "예상 비용", value: "월 평균 USD 830, 총 약 USD 5,000" },
];

export function ApiPlanningSubstep() {
  const router = useRouter();
  const [approval, setApproval] = useState<ApprovalExistence>("not-exists");
  const [budget, setBudget] = useState<BudgetCheckState>({
    budgetConfirmed: false,
    cardAvailable: false,
    costCenterUnderstood: false,
    managerReported: false,
  });

  const requiredCount =
    (budget.budgetConfirmed ? 1 : 0) +
    (budget.cardAvailable ? 1 : 0) +
    (budget.costCenterUnderstood ? 1 : 0);
  const requiredDone = requiredCount === 3;
  const optionalCount = budget.managerReported ? 1 : 0;

  const canProceed = approval !== null && requiredDone;

  const proceed = () => {
    if (!canProceed) return;
    const path =
      approval === "exists"
        ? "/governance/api-applications/form?approval=existing"
        : "/governance/api-applications/form";
    router.push(path);
  };

  return (
    <div className="space-y-4">
      {/* 페이지 헤더 */}
      <header>
        <div className="mb-1 flex items-center gap-2">
          <Plug size={16} aria-hidden="true" className="text-brand" />
          <h1 className="text-[18px] font-medium text-gray-900 dark:text-gray-100">
            API 활용 계획서
          </h1>
        </div>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          외부 API 도입 전 사용 목적·기간·비용을 사전 품의하는 신청입니다.
        </p>
      </header>

      <ApiProcessStepper currentSubstep="planning" onlyCurrentPhase />

      <HelpBanner message="신청서를 작성하기 전에 아래 사항을 미리 정리·확인해 주세요." />

      <PriorApprovalCheckCard value={approval} onChange={setApproval} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChecklistCard items={CHECKLIST} />
        <ExampleCard items={EXAMPLES} />
      </div>

      <BudgetCheckCard
        state={budget}
        onChange={setBudget}
        requiredCount={requiredCount}
        requiredDone={requiredDone}
        optionalCount={optionalCount}
      />

      {/* 하단 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3.5 dark:bg-gray-800/40">
        <span className="text-[12px] text-gray-500 dark:text-gray-400">
          {canProceed
            ? "모든 필수 항목 확인 완료. 신청서 작성으로 진행하세요."
            : "필수 항목을 모두 확인한 뒤 신청서 작성으로 진행하세요."}
        </span>
        <button
          type="button"
          onClick={proceed}
          disabled={!canProceed}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-4 py-2 text-[13px] font-medium text-blue-700 transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:bg-blue-900/30 dark:text-blue-300 dark:disabled:bg-gray-700/40 dark:disabled:text-gray-500"
        >
          신청서 작성으로 →
        </button>
      </div>
    </div>
  );
}

function PriorApprovalCheckCard({
  value,
  onChange,
}: {
  value: ApprovalExistence;
  onChange: (v: ApprovalExistence) => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-1.5 flex items-center gap-1.5">
        <FileSearch
          size={14}
          aria-hidden="true"
          className="text-amber-600 dark:text-amber-300"
        />
        <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
          사전 품의서 확인
        </h2>
        <span aria-label="필수" className="text-brand">
          *
        </span>
      </header>
      <p className="mb-2.5 text-[11px] text-gray-500 dark:text-gray-400">
        기존 사전 품의서가 있다면 신규 작성 없이 연결 가능합니다.
      </p>
      <div className="flex flex-col gap-1.5">
        <RadioOption
          name="approval-exists"
          value="exists"
          checked={value === "exists"}
          onSelect={() => onChange("exists")}
          title="기존 사전 품의서가 있습니다"
          description="품의번호를 신청서에 입력하면 신규 품의 없이 진행됩니다."
        />
        <RadioOption
          name="approval-exists"
          value="not-exists"
          checked={value === "not-exists"}
          onSelect={() => onChange("not-exists")}
          title="사전 품의서가 없습니다"
          description="Datahub에서 양식 작성 후 무전표 시스템에서 일반품의서 진행이 필요합니다."
        />
      </div>
    </section>
  );
}

function RadioOption({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md bg-gray-50 px-3 py-2.5 transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-600"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-gray-900 dark:text-gray-100">{title}</p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{description}</p>
      </div>
    </label>
  );
}

function ChecklistCard({ items }: { items: string[] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-1.5 flex items-center gap-1.5">
        <ListChecks size={14} aria-hidden="true" className="text-blue-700 dark:text-blue-300" />
        <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
          신청 전 검토 사항
        </h2>
      </header>
      <p className="mb-2.5 text-[11px] text-gray-500 dark:text-gray-400">
        아래 항목을 정리한 뒤 신청서 작성으로 진행하세요.
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-md bg-gray-50 px-3 py-2 text-[12px] text-gray-800 dark:bg-gray-800/40 dark:text-gray-200"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExampleCard({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-blue-50 px-4 py-3.5 dark:border-gray-800 dark:bg-blue-950/40">
      <header className="mb-1.5 flex items-center gap-1.5">
        <Lightbulb size={14} aria-hidden="true" className="text-blue-700 dark:text-blue-300" />
        <h2 className="text-[13px] font-medium text-blue-700 dark:text-blue-300">
          작성 예시
        </h2>
      </header>
      <p className="mb-2.5 text-[11px] text-blue-700 dark:text-blue-300">
        실제 신청자가 이렇게 정리했습니다.
      </p>
      <ul className="flex flex-col gap-2 text-[11px] leading-[1.6]">
        {items.map((it) => (
          <li key={it.label}>
            <p className="font-medium text-blue-700 dark:text-blue-300">{it.label}</p>
            <p className="text-gray-700 dark:text-gray-300">{it.value}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BudgetCheckCard({
  state,
  onChange,
  requiredCount,
  requiredDone,
  optionalCount,
}: {
  state: BudgetCheckState;
  onChange: (next: BudgetCheckState) => void;
  requiredCount: number;
  requiredDone: boolean;
  optionalCount: number;
}) {
  const set = (key: keyof BudgetCheckState) =>
    onChange({ ...state, [key]: !state[key] });

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-1.5 flex items-center gap-1.5">
        <Coins
          size={14}
          aria-hidden="true"
          className={
            requiredDone
              ? "text-green-700 dark:text-green-300"
              : "text-amber-600 dark:text-amber-300"
          }
        />
        <h2 className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
          예산 및 결제 수단 확인
        </h2>
        <span aria-label="필수" className="text-brand">
          *
        </span>
        {requiredDone && (
          <span className="ml-1 inline-flex items-center rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            확인 완료
          </span>
        )}
      </header>
      <p className="mb-2.5 text-[11px] text-gray-500 dark:text-gray-400">
        API 비용은 개인 법인카드로 결제 후 사전 품의서로 처리됩니다.
      </p>
      <div className="flex flex-col gap-1.5">
        <CheckOption
          id="budget-confirmed"
          checked={state.budgetConfirmed}
          onToggle={() => set("budgetConfirmed")}
        >
          소속 조직의 가용 예산 확인
        </CheckOption>
        <CheckOption
          id="card-available"
          checked={state.cardAvailable}
          onToggle={() => set("cardAvailable")}
        >
          개인 법인카드 사용 가능 여부 확인
        </CheckOption>
        <CheckOption
          id="costcenter-understood"
          checked={state.costCenterUnderstood}
          onToggle={() => set("costCenterUnderstood")}
        >
          CostCenter <strong className="font-medium">지급수수료-API</strong> 사용 정책 이해
        </CheckOption>
        <CheckOption
          id="manager-reported"
          checked={state.managerReported}
          onToggle={() => set("managerReported")}
        >
          조직장 사전 보고 완료{" "}
          <span className="text-[11px] text-gray-400 dark:text-gray-500">(필요 시)</span>
        </CheckOption>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-2.5 dark:border-gray-800">
        <span
          className={`text-[11px] ${
            requiredDone
              ? "font-medium text-green-700 dark:text-green-300"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          필수 항목 {requiredCount}/3 확인됨
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          선택 항목 {optionalCount}/1
        </span>
      </div>
    </section>
  );
}

function CheckOption({
  id,
  checked,
  onToggle,
  children,
}: {
  id: string;
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-md bg-gray-50 px-3 py-2.5 transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div
        className={`flex-1 text-[12px] leading-[1.5] ${
          checked
            ? "text-gray-400 line-through dark:text-gray-500"
            : "text-gray-800 dark:text-gray-200"
        }`}
      >
        {children}
      </div>
    </label>
  );
}
