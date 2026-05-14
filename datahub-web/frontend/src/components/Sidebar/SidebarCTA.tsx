// Governance 트리 최상단 CTA — '새 신청 시작' 으로 intake 페이지 진입.
//   다른 메뉴와 시각적으로 구분되는 단일 액션 (브랜드 컬러 채움).

"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { GOVERNANCE_CTA } from "./sidebar.config";

export function SidebarCTA() {
  return (
    <Link
      href={GOVERNANCE_CTA.path}
      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#185FA5] px-3 py-2 text-[13px] font-medium text-white outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#185FA5]/50 dark:bg-[#185FA5] dark:hover:brightness-110"
    >
      <Plus size={14} strokeWidth={2.25} />
      <span>{GOVERNANCE_CTA.label}</span>
    </Link>
  );
}
