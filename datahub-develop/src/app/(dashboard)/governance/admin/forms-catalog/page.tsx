// 관리 · 신청서 양식 카탈로그 — 시스템에 등록된 모든 신청서 양식을 카테고리별로 정리.
//   각 카드 클릭 → /governance/admin/forms-catalog/[formId] 미리보기 페이지로 이동.

"use client";

import Link from "next/link";
import { ChevronRight, FileText, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { api, type Me } from "@/lib/governance/api-client-full";
import {
  CATALOG,
  CATALOG_CATEGORY_LABEL,
  type CatalogCategoryId,
} from "./catalog-config";

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
  const groups = (Object.keys(CATALOG_CATEGORY_LABEL) as CatalogCategoryId[]).map((c) => ({
    id: c,
    label: CATALOG_CATEGORY_LABEL[c],
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
          시스템에 등록된 모든 신청서 양식을 카테고리별로 정리했습니다. 항목을 클릭하면 해당 양식을 미리볼 수 있습니다.
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
                  href={`/governance/admin/forms-catalog/${it.id}`}
                  className="group flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 transition hover:-translate-y-px hover:border-brand/40 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-red-900/40"
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
                    className="shrink-0 text-gray-400 transition group-hover:text-brand"
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
