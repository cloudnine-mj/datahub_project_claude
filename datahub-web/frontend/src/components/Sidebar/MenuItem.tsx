// 메뉴 1행 — 아이콘 + 라벨 + (선택) 배지. 활성/호버/포커스 상태 관리.
//   활성 판정: path + query 비교. ('?mine=1' 같은 같은-경로 변형 구분)
//   폰트 weight 는 400/500 만 사용.

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { MenuItem as MenuItemData } from "./sidebar.config";
import { MenuBadge } from "./MenuBadge";

interface Props {
  item: MenuItemData;
}

export function MenuItem({ item }: Props) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const currentQuery = searchParams?.toString() ?? "";

  const [itemPath, itemQuery = ""] = item.path.split("?");
  // 정확 매치 — 같은 경로의 ?mine=1 / ?status=approved 변형을 구분.
  // query 가 비어 있는 항목은 query 가 빈 경우에만 active 로 본다 (서브 변형 흡수 방지).
  const active = pathname === itemPath && currentQuery === itemQuery;

  const Icon = item.icon;

  return (
    <Link
      href={item.path}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-[#185FA5]/40 ${
        active
          ? "bg-[#E6F1FB] font-medium text-[#185FA5] dark:bg-blue-900/30 dark:text-blue-300"
          : "font-normal text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
      }`}
    >
      <Icon
        size={15}
        className={
          active
            ? "text-[#185FA5] dark:text-blue-300"
            : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
        }
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <MenuBadge count={item.badge.count} variant={item.badge.variant} />}
    </Link>
  );
}
