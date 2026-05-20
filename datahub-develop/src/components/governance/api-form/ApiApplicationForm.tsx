// API 활용 계획서 — 신청서 작성 양식.
//   섹션: 신청자 정보(자동) / 신청 정보 (연관 프로젝트 + API 사용 목적 + 사용 서비스 N개
//   + 총 예상 비용 자동 합계) / 파일 첨부.
//   서비스는 최소 1개 (서비스 1 의 X 버튼 비활성), 추가/삭제 가능.
//   총 예상 비용은 통화별 분리 합산 (환율 변환 없음).

"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Plus, Upload, X } from "lucide-react";
import { NumberInput } from "@/components/governance/NumberInput";

export type Currency = "USD" | "KRW";

export interface ApiService {
  id: string;
  serviceName: string;
  startDate: string;
  endDate: string;
  currency: Currency;
  estimatedCost: number;
}

export interface ApiApplicant {
  name: string;
  department: string;
  email: string;
}

export interface ApiFormValues {
  projectName: string;
  apiPurpose: string;
  services: ApiService[];
  files: File[];
}

interface Props {
  applicant: ApiApplicant;
  values: ApiFormValues;
  onChange: (next: ApiFormValues) => void;
}

function uid() {
  return `svc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function newService(): ApiService {
  return {
    id: uid(),
    serviceName: "",
    startDate: "",
    endDate: "",
    currency: "USD",
    estimatedCost: 0,
  };
}

function effectiveCurrency(svc: ApiService): string {
  return svc.currency;
}

/** 통화 코드 → 입력 prefix 심볼. ISO 코드(EUR/JPY/...) 도 매핑.
 *  매핑에 없는 통화는 그 자체 문자열(예: 'CHF') 을 prefix 로 노출. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  KRW: "₩",
  EUR: "€",
  JPY: "¥",
  CNY: "¥",
  GBP: "£",
  HKD: "HK$",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  TWD: "NT$",
  INR: "₹",
  VND: "₫",
  THB: "฿",
  IDR: "Rp",
  MYR: "RM",
  PHP: "₱",
};

function currencySymbol(svc: ApiService): string {
  const code = effectiveCurrency(svc);
  return CURRENCY_SYMBOLS[code] ?? code;
}

function calculateTotals(services: ApiService[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const s of services) {
    const c = effectiveCurrency(s);
    totals[c] = (totals[c] ?? 0) + (Number(s.estimatedCost) || 0);
  }
  return totals;
}

function formatTotalCost(totals: Record<string, number>): string {
  const parts = Object.entries(totals)
    .filter(([, amt]) => amt > 0)
    .map(([c, amt]) => `${c} ${amt.toLocaleString()}`);
  return parts.length === 0 ? "—" : parts.join(" + ");
}

export function ApiApplicationForm({ applicant, values, onChange }: Props) {
  const totals = useMemo(() => calculateTotals(values.services), [values.services]);

  const update = (patch: Partial<ApiFormValues>) => onChange({ ...values, ...patch });

  const updateService = (id: string, patch: Partial<ApiService>) => {
    update({
      services: values.services.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const addService = () => {
    update({ services: [...values.services, newService()] });
  };

  const removeService = (id: string) => {
    if (values.services.length <= 1) return;
    update({ services: values.services.filter((s) => s.id !== id) });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-6 py-5 dark:border-gray-800 dark:bg-gray-900">
      {/* 양식 헤더 */}
      <header className="mb-4 border-b border-gray-200 pb-3.5 dark:border-gray-800">
        <div className="mb-1 flex items-center gap-2">
          <FileText
            size={16}
            aria-hidden="true"
            className="text-blue-700 dark:text-blue-300"
          />
          <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
            API 활용 신청서
          </h2>
        </div>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">
          계획 수립 단계에서 정리한 내용을 입력하세요.
        </p>
      </header>

      {/* 신청자 정보 */}
      <div className="mb-5">
        <SectionHeader title="신청자 정보" />
        <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-700 dark:bg-gray-900">
          <dl
            className="grid gap-y-2 gap-x-3.5 text-[12px]"
            style={{ gridTemplateColumns: "120px 1fr" }}
          >
            <dt className="text-gray-500 dark:text-gray-400">이름</dt>
            <dd className="text-gray-900 dark:text-gray-100">{applicant.name}</dd>
            <dt className="text-gray-500 dark:text-gray-400">소속</dt>
            <dd className="text-gray-900 dark:text-gray-100">{applicant.department}</dd>
            <dt className="text-gray-500 dark:text-gray-400">이메일</dt>
            <dd className="text-gray-900 dark:text-gray-100">{applicant.email}</dd>
          </dl>
        </div>
      </div>

      {/* 신청 정보 */}
      <div className="mb-5">
        <SectionHeader title="신청 정보" required />

        {/* 공통 필드 — 연관 프로젝트 / API 사용 목적 */}
        <div
          className="mb-4 grid items-start gap-x-3.5 gap-y-3 text-[12px]"
          style={{ gridTemplateColumns: "120px 1fr" }}
        >
          <label className="pt-2 text-gray-500 dark:text-gray-400" htmlFor="api-project">
            연관 프로젝트 <span className="text-brand">*</span>
          </label>
          <input
            id="api-project"
            type="text"
            value={values.projectName}
            onChange={(e) => update({ projectName: e.target.value })}
            placeholder="예: 2026 고객 행동 분석 플랫폼 구축"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />

          <label className="pt-2 text-gray-500 dark:text-gray-400" htmlFor="api-purpose">
            API 사용 목적 <span className="text-brand">*</span>
          </label>
          <textarea
            id="api-purpose"
            value={values.apiPurpose}
            onChange={(e) => update({ apiPurpose: e.target.value })}
            placeholder="예: LLM 기반 리포트 자동 생성 및 데이터 분석 워크플로우 효율화"
            className="min-h-[70px] resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        {/* 사용 서비스 */}
        <div className="mb-3.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] text-gray-500 dark:text-gray-400">
              사용 서비스 <span className="text-brand">*</span>
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              서비스 {values.services.length}개
            </span>
          </div>

          <div className="space-y-2">
            {values.services.map((svc, i) => (
              <ServiceCard
                key={svc.id}
                index={i + 1}
                service={svc}
                onChange={(patch) => updateService(svc.id, patch)}
                onRemove={() => removeService(svc.id)}
                canRemove={values.services.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addService}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-transparent px-3 py-2.5 text-[12px] text-blue-700 transition hover:bg-blue-50/40 dark:border-gray-600 dark:text-blue-300 dark:hover:bg-blue-950/20"
          >
            <Plus size={13} aria-hidden="true" />
            서비스 추가
          </button>
        </div>

        {/* 총 예상 비용 */}
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3.5 dark:bg-blue-950/40">
          <div>
            <div className="text-[12px] font-medium text-blue-700 dark:text-blue-300">
              총 예상 비용
            </div>
            <div className="mt-0.5 text-[10px] text-blue-700/75 dark:text-blue-300/75">
              서비스별 예상 비용 자동 합계
            </div>
          </div>
          <span className="text-[18px] font-medium text-blue-700 dark:text-blue-300">
            {formatTotalCost(totals)}
          </span>
        </div>
      </div>

      {/* 파일 첨부 */}
      <div>
        <SectionHeader title="파일 첨부" />
        <FileAttachment
          files={values.files}
          onChange={(files) => update({ files })}
        />
      </div>
    </section>
  );
}

function SectionHeader({ title, required }: { title: string; required?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <span aria-hidden="true" className="h-3.5 w-[3px] rounded-[1px] bg-brand" />
      <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{title}</span>
      {required && <span className="text-brand">*</span>}
    </div>
  );
}

interface ServiceCardProps {
  index: number;
  service: ApiService;
  onChange: (patch: Partial<ApiService>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function ServiceCard({ index, service, onChange, onRemove, canRemove }: ServiceCardProps) {
  const setCurrency = (c: Currency) => {
    onChange({ currency: c });
  };

  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3.5 dark:bg-gray-800/40">
      <header className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">
          서비스 {index}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="서비스 삭제"
          className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:text-gray-200"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      <div
        className="grid items-start gap-x-3.5 gap-y-2.5 text-[12px]"
        style={{ gridTemplateColumns: "100px 1fr" }}
      >
        <label className="pt-2 text-gray-500 dark:text-gray-400">서비스명</label>
        <input
          type="text"
          value={service.serviceName}
          onChange={(e) => onChange({ serviceName: e.target.value })}
          placeholder="예: Claude API"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />

        <label className="pt-2 text-gray-500 dark:text-gray-400">사용 기간</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={service.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
          <span className="text-gray-400 dark:text-gray-500">~</span>
          <input
            type="date"
            value={service.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <label className="pt-2 text-gray-500 dark:text-gray-400">결제 통화</label>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pt-1.5">
          <CurrencyRadio
            name={`currency-${service.id}`}
            value="USD"
            checked={service.currency === "USD"}
            onChange={() => setCurrency("USD")}
            label="USD"
          />
          <CurrencyRadio
            name={`currency-${service.id}`}
            value="KRW"
            checked={service.currency === "KRW"}
            onChange={() => setCurrency("KRW")}
            label="KRW"
          />
        </div>

        <label className="pt-2 text-gray-500 dark:text-gray-400">예상 비용</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[12px] font-medium text-gray-500 dark:text-gray-400">
            {currencySymbol(service)}
          </span>
          <NumberInput
            value={service.estimatedCost === 0 ? "" : service.estimatedCost}
            onChange={(n) => onChange({ estimatedCost: n })}
            placeholder="예: 3,000"
            className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
      </div>
    </div>
  );
}

function CurrencyRadio({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-gray-800 dark:text-gray-200">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-brand"
      />
      {label}
    </label>
  );
}

function FileAttachment({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => ref.current?.click();
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3.5 py-2 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <Upload size={13} aria-hidden="true" />
        파일 선택
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onChange(Array.from(e.target.files ?? []))}
      />
      <span className="text-[11px] text-gray-400 dark:text-gray-500">
        샘플 데이터, 작업 가이드라인 등 · 최대 50MB
      </span>
      {files.length > 0 && (
        <ul className="ml-1 flex flex-wrap gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800"
            >
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
