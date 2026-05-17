// 준비중 안내 페이지 — 대시보드 위젯 '바로가기' 의 임시 도착지.
//   ?from=datasets / ?from=notices 쿼리로 어느 경로에서 왔는지만 구분.

import Link from "next/link";
import { Construction } from "lucide-react";

const TITLES: Record<string, string> = {
  datasets: "내가 적재한 데이터",
  notices: "최근 공지",
};

export default function Page({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const from = searchParams?.from ?? "";
  const sectionTitle = TITLES[from];

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center text-center">
        <Construction
          size={40}
          aria-hidden="true"
          className="mb-3 text-gray-400 dark:text-gray-500"
        />
        <h1 className="text-[18px] font-medium text-gray-900 dark:text-gray-100">
          준비중인 페이지입니다
        </h1>
        {sectionTitle && (
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            {sectionTitle} 전체 목록은 곧 제공될 예정입니다.
          </p>
        )}
        <Link
          href="/governance/home"
          className="mt-5 inline-flex items-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          나의 현황으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
