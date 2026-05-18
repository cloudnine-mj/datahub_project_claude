// 관리 · 신청서 양식 카탈로그 — 시스템에 존재하는 모든 신청서 양식을 카테고리별로 정리해 한 페이지에 노출.
//   각 항목은 카테고리 / 이름 / 설명 / 진입 경로 링크. 관리자가 양식 구성을 한눈에 점검하는 용도.
//   (양식 자체의 편집 기능은 추후 별도 페이지로 분리.)

"use client";

import Link from "next/link";
import { ChevronRight, FileText, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { api, type Me } from "@/lib/api";
import { FORM_SCHEMAS } from "@/lib/formSchemas";
import { FORM_TYPE_LABELS } from "@/lib/utils";

type CategoryId = "data" | "log-api" | "tool";

interface CatalogItem {
  id: string;
  category: CategoryId;
  label: string;
  description: string;
  /** 양식 진입 경로. 멀티스텝 플로우면 첫 substep 의 경로. */
  href: string;
}

const CATEGORY_LABELS: Record<CategoryId, string> = {
  data: "데이터 도입",
  "log-api": "로그 · API",
  tool: "업무 도구",
};

// 시스템에 존재하는 모든 신청서 양식 — 각 항목은 곧바로 해당 양식 화면으로 진입.
// 멀티스텝 플로우의 계획 수립 / 결재 / 적재 등 다른 substep 은 포함하지 않음.
const CATALOG: CatalogItem[] = [
  {
    id: "data_production",
    category: "data",
    label: FORM_TYPE_LABELS["data_production"],
    description: FORM_SCHEMAS["data_production"]?.description ?? "",
    href: "/governance/forms/intake?type=service",
  },
  {
    id: "data_purchase",
    category: "data",
    label: FORM_TYPE_LABELS["data_purchase"],
    description: FORM_SCHEMAS["data_purchase"]?.description ?? "",
    href: "/governance/forms/intake?type=purchase",
  },
  {
    id: "data_subscription",
    category: "data",
    label: FORM_TYPE_LABELS["data_subscription"],
    description: FORM_SCHEMAS["data_subscription"]?.description ?? "",
    href: "/governance/forms/intake?type=subscribe",
  },
  {
    id: "data_production_plan",
    category: "data",
    label: FORM_TYPE_LABELS["data_production_plan"],
    description: FORM_SCHEMAS["data_production_plan"]?.description ?? "",
    href: "/governance/forms/data_production_plan/new",
  },
  {
    id: "api_usage_plan",
    category: "log-api",
    label: FORM_TYPE_LABELS["api_usage_plan"],
    description: FORM_SCHEMAS["api_usage_plan"]?.description ?? "",
    href: "/governance/api-applications/form",
  },
  {
    id: "product_log_usage",
    category: "log-api",
    label: FORM_TYPE_LABELS["product_log_usage"],
    description: FORM_SCHEMAS["product_log_usage"]?.description ?? "",
    href: "/governance/forms/product_log_usage/new",
  },
  {
    id: "productivity_tool",
    category: "tool",
    label: FORM_TYPE_LABELS["productivity_tool"],
    description: FORM_SCHEMAS["productivity_tool"]?.description ?? "",
    href: "/governance/forms/productivity_tool/new",
  },
];

export default function Page() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  if (me && me.user.role !== "admin") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-500">
          <Lock size={36} />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">접근 권한 없음</h1>
        <p className="mt-2 text-sm text-gray-500">관리자만 양식 카탈로그를 조회할 수 있습니다.</p>
        <Link
          href="/governance/home"
          className="mt-5 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          나의 현황으로 돌아가기
        </Link>
      </div>
    );
  }

  // 카테고리별로 그룹핑.
  const groups = (Object.keys(CATEGORY_LABELS) as CategoryId[]).map((c) => ({
    id: c,
    label: CATEGORY_LABELS[c],
    items: CATALOG.filter((it) => it.category === c),
  }));

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "신청서 양식 카탈로그" },
        ]}
      />
      <header>
        <h1 className="text-3xl font-bold tracking-tight">신청서 양식 카탈로그</h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          시스템에 등록된 모든 신청서 양식을 카테고리별로 정리했습니다. 항목을 클릭하면 해당 양식 화면으로 이동합니다.
        </p>
      </header>

      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="mb-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">
            {group.label}{" "}
            <span className="ml-1 text-gray-400 dark:text-gray-500">({group.items.length})</span>
          </h2>
          <ul className="space-y-2">
            {group.items.map((it) => (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 transition hover:border-brand/40 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-red-900/40"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <FileText
                      size={18}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-brand"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {it.label}
                      </div>
                      {it.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {it.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-gray-400"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
