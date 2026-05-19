// 신청서 양식 카탈로그 — 단일 출처 config.
//   카탈로그 목록 페이지와 양식 미리보기 페이지가 공유.

import { FORM_SCHEMAS } from "@/lib/governance/forms/schemas";
import { FORM_TYPE_LABELS } from "@/lib/governance/forms/utils-bridge";

export type CatalogCategoryId = "data" | "log-api" | "tool";

export interface CatalogEntry {
  /** URL 파라미터 + 라우팅 키. */
  id: string;
  category: CatalogCategoryId;
  label: string;
  description: string;
  /** 실제 신청 화면 경로 — 안내 박스에 표시. */
  usagePath: string;
  /** 양식 정의 컴포넌트 경로 — 안내 박스에 표시. */
  componentPath: string;
}

export const CATALOG_CATEGORY_LABEL: Record<CatalogCategoryId, string> = {
  data: "데이터 도입",
  "log-api": "로그 · API",
  tool: "업무 도구",
};

export const CATALOG: CatalogEntry[] = [
  {
    id: "data_production",
    category: "data",
    label: FORM_TYPE_LABELS["data_production"],
    description: FORM_SCHEMAS["data_production"]?.description ?? "",
    usagePath: "/governance/forms/intake?type=service",
    componentPath: "lib/formSchemas.ts → dataServiceForm",
  },
  {
    id: "data_purchase",
    category: "data",
    label: FORM_TYPE_LABELS["data_purchase"],
    description: FORM_SCHEMAS["data_purchase"]?.description ?? "",
    usagePath: "/governance/forms/intake?type=purchase",
    componentPath: "lib/formSchemas.ts → dataPurchase",
  },
  {
    id: "data_subscription",
    category: "data",
    label: FORM_TYPE_LABELS["data_subscription"],
    description: FORM_SCHEMAS["data_subscription"]?.description ?? "",
    usagePath: "/governance/forms/intake?type=subscribe",
    componentPath: "lib/formSchemas.ts → dataSubscription",
  },
  {
    id: "data_production_plan",
    category: "data",
    label: FORM_TYPE_LABELS["data_production_plan"],
    description: FORM_SCHEMAS["data_production_plan"]?.description ?? "",
    usagePath: "/governance/forms/data_production_plan/new",
    componentPath: "lib/formSchemas.ts → dataProductionPlan",
  },
  {
    id: "api_usage_plan",
    category: "log-api",
    label: FORM_TYPE_LABELS["api_usage_plan"],
    description: FORM_SCHEMAS["api_usage_plan"]?.description ?? "",
    usagePath: "/governance/api-applications/form",
    componentPath: "components/api-form/ApiApplicationForm.tsx",
  },
  {
    id: "product_log_usage",
    category: "log-api",
    label: FORM_TYPE_LABELS["product_log_usage"],
    description: FORM_SCHEMAS["product_log_usage"]?.description ?? "",
    usagePath: "/governance/forms/product_log_usage/new",
    componentPath: "lib/formSchemas.ts → productLogUsage",
  },
  {
    id: "productivity_tool",
    category: "tool",
    label: FORM_TYPE_LABELS["productivity_tool"],
    description: FORM_SCHEMAS["productivity_tool"]?.description ?? "",
    usagePath: "/governance/forms/productivity_tool/new",
    componentPath: "lib/formSchemas.ts → productivityTool",
  },
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.id === id);
}
