// 용역(service): 2. 구축 단계 — 3 카드(계약/중간 수령/최종 수령) 한 페이지 노출.
// 구매·구독(purchase/subscribe): 1. 기획 마지막 substep '계약 체결' — 계약 카드만 노출.
//
// 사이드바 구조는 datahub-web `Sidebar/sidebar.config.ts` 와 동일.
"use client";

import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Code,
  FileText,
  Hammer,
  Home,
  Inbox,
  RefreshCw,
  Route,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { SectionNav, SectionNavItem } from "@/components/storyboard/section-nav";

const items: SectionNavItem[] = [
  // 홈 — 그룹 밖 단독
  { title: "나의 현황", href: "/governance/home", icon: Home },

  // 통합 검색
  { title: "거버넌스 요청 목록", href: "/governance/forms/list", icon: ClipboardList, group: "통합 검색" },

  // 신청서
  { title: "데이터 용역 제작", href: "/governance/forms/planning?type=service", icon: Hammer, group: "신청서" },
  { title: "데이터 구매", href: "/governance/forms/planning?type=purchase", icon: ShoppingCart, group: "신청서" },
  { title: "데이터 구독", href: "/governance/forms/planning?type=subscribe", icon: RefreshCw, group: "신청서" },
  { title: "Product 로그 활용", href: "/governance/forms/product_log_usage/new", icon: FileText, group: "신청서" },
  { title: "API 활용 계획서", href: "/governance/api-applications/planning", icon: Code, group: "신청서" },

  // 가이드
  { title: "프로세스 안내", href: "/governance/process", icon: Route, group: "가이드" },
  { title: "거버넌스 정책", href: "/governance/policy", icon: BookOpen, group: "가이드" },

  // 관리 (admin only — 추후 me.role === 'admin' 일 때만 노출하도록 컨디션 추가 가능)
  { title: "거버넌스 요청 관리", href: "/governance/admin/forms", icon: Inbox, group: "관리" },
  { title: "프로세스 관리", href: "/governance/process?manage=1", icon: Route, group: "관리" },
  { title: "거버넌스 정책 관리", href: "/governance/policy?manage=1", icon: BookOpen, group: "관리" },
  { title: "신청서 양식 카탈로그", href: "/governance/admin/forms-catalog", icon: Settings, group: "관리" },
  { title: "통계·리포트", href: "/governance/admin/stats", icon: BarChart3, group: "관리" },
];

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <SectionNav items={items} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
