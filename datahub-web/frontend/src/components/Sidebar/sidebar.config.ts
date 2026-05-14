// 사이드바 Governance 트리 메뉴 데이터.
//   - 홈 항목(나의 현황) 은 그룹 밖 단독 — CTA 위에 별도 노출.
//   - 그룹 단위로 묶고 각 그룹마다 항목 배열을 둠.
//   - 관리(admin) 그룹은 adminOnly=true 로 표시. 사이드바가 권한에 따라 DOM 자체에서 제외.

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  ClipboardList,
  Code,
  Database,
  FileText,
  Home,
  Inbox,
  Route,
  Settings,
  Users,
  Wrench,
} from "lucide-react";

export type BadgeVariant = "info" | "danger" | "neutral";

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: {
    count: number | string;
    variant: BadgeVariant;
  };
  adminOnly?: boolean;
}

export interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
  adminOnly?: boolean;
  /** 헤더 옆 자물쇠 아이콘 표시 — admin 전용 그룹의 시각 단서 */
  locked?: boolean;
}

/** Governance 트리 최상단의 홈 항목 — 그룹과 분리된 단독 메뉴. */
export const GOVERNANCE_HOME: MenuItem = {
  id: "home",
  label: "나의 현황",
  icon: Home,
  path: "/governance/home",
};

/** 사이드바 CTA — '새 신청 시작'. 메뉴와 구분되는 단일 액션. */
export const GOVERNANCE_CTA = {
  label: "새 신청 시작",
  path: "/governance/forms/intake",
};

export const GOVERNANCE_GROUPS: MenuGroup[] = [
  {
    id: "all-requests",
    label: "전체 요청",
    items: [
      {
        id: "request-list",
        label: "거버넌스 요청 목록",
        icon: ClipboardList,
        path: "/governance/forms/list",
      },
      {
        id: "bookmarked",
        label: "관심 신청",
        icon: Bookmark,
        path: "/governance/forms/list?bookmarked=1",
      },
    ],
  },
  {
    id: "applications",
    label: "신청서",
    items: [
      {
        id: "data-intake",
        label: "데이터 용역/구매/구독",
        icon: Database,
        path: "/governance/forms/intake",
      },
      {
        id: "product-log",
        label: "Product 로그 활용",
        icon: FileText,
        path: "/governance/forms/product_log_usage/new",
      },
      {
        id: "api-plan",
        label: "API 활용 계획서",
        icon: Code,
        path: "/governance/forms/api_usage_plan/new",
      },
      {
        id: "productivity",
        label: "업무생산성 도구",
        icon: Wrench,
        path: "/governance/forms/productivity_tool/new",
      },
    ],
  },
  {
    id: "guide",
    label: "가이드",
    items: [
      {
        id: "process",
        label: "프로세스 안내",
        icon: Route,
        path: "/governance/process",
      },
      {
        id: "policy",
        label: "거버넌스 정책",
        icon: BookOpen,
        path: "/governance/policy",
      },
      {
        id: "team",
        label: "담당자 안내",
        icon: Users,
        path: "/governance/team",
      },
    ],
  },
  {
    id: "admin",
    label: "관리",
    adminOnly: true,
    locked: true,
    items: [
      {
        id: "approval-queue",
        label: "신청 처리 큐",
        icon: Inbox,
        path: "/governance/admin/forms",
        badge: { count: 12, variant: "neutral" },
      },
      {
        id: "stats",
        label: "통계·리포트",
        icon: BarChart3,
        path: "/governance/admin/stats",
      },
      {
        id: "manage",
        label: "정책·양식 관리",
        icon: Settings,
        path: "/governance/forms/my",
      },
    ],
  },
];
