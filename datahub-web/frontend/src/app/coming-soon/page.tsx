// 최상위 '준비중' 안내 페이지 — Datahub 사이드바의 미구현 영역(Models / Datasets /
//   Projects / Analytics / Organizations) 진입 시 표시.
//   ?from= 쿼리로 어느 영역인지만 구분.

import Link from "next/link";
import { Construction } from "lucide-react";

const TITLES: Record<string, { title: string; description: string }> = {
  models: {
    title: "Models",
    description: "모델 카탈로그·검색 화면은 곧 제공될 예정입니다.",
  },
  datasets: {
    title: "Datasets",
    description: "데이터셋 카탈로그·검색 화면은 곧 제공될 예정입니다.",
  },
  projects: {
    title: "Projects",
    description: "프로젝트 관리 화면은 곧 제공될 예정입니다.",
  },
  analytics: {
    title: "Analytics",
    description: "분석 대시보드는 곧 제공될 예정입니다.",
  },
  organizations: {
    title: "Organizations",
    description: "조직 관리 화면은 곧 제공될 예정입니다.",
  },
};

const DEFAULT_SECTION = {
  title: "",
  description: "해당 영역은 곧 제공될 예정입니다.",
};

export default function Page({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const section = TITLES[searchParams?.from ?? ""] ?? DEFAULT_SECTION;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center text-center">
        <Construction
          size={40}
          aria-hidden="true"
          className="mb-3 text-gray-400 dark:text-gray-500"
        />
        <h1 className="text-[18px] font-medium text-gray-900 dark:text-gray-100">
          {section.title || "준비중"}
        </h1>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
          {section.description}
        </p>
        <Link
          href="/governance/home"
          className="mt-5 inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Governance 홈으로
        </Link>
      </div>
    </div>
  );
}
