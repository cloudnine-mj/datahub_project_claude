// 2단계 · 비용 처리 — current 상태 body.
//   3 sub 영역:
//     1) 연결된 품의서 (읽기 전용) — 1단계 전자결재에서 발급된 번호 표시
//     2) 월별 사용 비용 — 누적 기록 + '이번 달 비용 기록' 추가 인라인 폼
//     3) PMS·랩 담당자·DG팀 메일 보고 흐름 안내 (info 박스)

"use client";

import { useState } from "react";
import { Info, Link2, Plus } from "lucide-react";
import type { CostProcessStep, CostRecord, Currency } from "./useOperatePhase";
import { NumberInput } from "@/components/governance/NumberInput";

interface Props {
  costProcess: CostProcessStep;
  onAddRecord: (input: {
    services: string[];
    currency: Currency;
    amount: number;
  }) => void;
}

const SERVICE_OPTIONS = ["Claude API", "OpenAI GPT-4 API", "Gemini API", "기타"];

export function CostProcessStepBody({ costProcess, onAddRecord }: Props) {
  return (
    <div className="space-y-3">
      <LinkedApprovalCard
        approvalNumber={costProcess.approvalNumber}
        costCenter={costProcess.costCenter}
      />
      <MonthlyCostList records={costProcess.costRecords} onAdd={onAddRecord} />
      <InfoNote />
    </div>
  );
}

function LinkedApprovalCard({
  approvalNumber,
  costCenter,
}: {
  approvalNumber: string;
  costCenter: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3.5 py-3 dark:bg-gray-800/40">
      <div className="mb-2 flex items-center gap-1.5">
        <Link2 size={13} aria-hidden="true" className="text-gray-600 dark:text-gray-300" />
        <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
          연결된 품의서
        </span>
      </div>
      <dl
        className="grid gap-x-3.5 gap-y-1.5 text-[12px]"
        style={{ gridTemplateColumns: "auto 1fr" }}
      >
        <dt className="text-gray-500 dark:text-gray-400">품의번호</dt>
        <dd className="font-mono text-gray-900 dark:text-gray-100">{approvalNumber}</dd>
        <dt className="text-gray-500 dark:text-gray-400">CostCenter</dt>
        <dd className="text-gray-900 dark:text-gray-100">
          {costCenter} / <strong className="font-medium">지급수수료-API</strong>
        </dd>
      </dl>
    </div>
  );
}

function MonthlyCostList({
  records,
  onAdd,
}: {
  records: CostRecord[];
  onAdd: (input: { services: string[]; currency: Currency; amount: number }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("");

  const toggleService = (s: string) => {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const canSubmit = services.length > 0 && Number(amount) > 0;

  const submit = () => {
    if (!canSubmit) return;
    onAdd({ services, currency, amount: Number(amount) });
    setAdding(false);
    setServices([]);
    setCurrency("USD");
    setAmount("");
  };

  return (
    <div className="rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-700">
      <header className="mb-2.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
          월별 사용 비용
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {records.length}건 기록
        </span>
      </header>

      {records.length > 0 && (
        <ul className="mb-2.5 flex flex-col gap-1.5">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-[11px] dark:bg-gray-800/40"
            >
              <span className="w-[60px] shrink-0 text-gray-500 dark:text-gray-400">
                {r.month}
              </span>
              <span className="flex-1 truncate text-gray-800 dark:text-gray-200">
                {r.services.join(" · ")}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {r.currency} {r.amount.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50/60 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/30">
          <div>
            <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">사용 서비스</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_OPTIONS.map((s) => {
                const selected = services.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleService(s)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] transition ${
                      selected
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">통화</p>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="USD">USD</option>
                <option value="KRW">KRW</option>
                <option value="OTHER">그 외</option>
              </select>
            </div>
            <div className="flex-1">
              <p className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">금액</p>
              <NumberInput
                value={amount}
                onChange={(_n, raw) => setAmount(raw)}
                placeholder="예: 580"
                className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[12px] placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="rounded-md bg-blue-50 px-3 py-1 text-[12px] font-medium text-blue-700 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-md px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 bg-transparent px-3 py-1.5 text-[11px] text-gray-500 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800/40"
        >
          <Plus size={13} aria-hidden="true" />
          이번 달 비용 기록
        </button>
      )}
    </div>
  );
}

function InfoNote() {
  return (
    <div className="flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 dark:bg-blue-950/40">
      <Info
        size={14}
        aria-hidden="true"
        className="mt-px shrink-0 text-blue-700 dark:text-blue-300"
      />
      <span className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
        매월 PMS 프로젝트별 사용 비용을 정리하여 랩별 담당자에게 전달하면, 담당자가 랩 전체를 취합하여 DG팀에 메일로 보고합니다.
      </span>
    </div>
  );
}
