"use client";

import {
  Inbox,
  FileCheck2,
  FileText,
  FolderKanban,
  Home,
  BookOpen,
  Workflow,
  ScrollText,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { SectionNav, SectionNavItem } from "@/components/storyboard/section-nav";

const items: SectionNavItem[] = [
  { title: "Home", href: "/governance/home", icon: Home, group: "거버넌스" },
  { title: "Requests (storyboard)", href: "/governance", icon: Inbox, badge: 42, group: "거버넌스" },
  { title: "신청서 카탈로그", href: "/governance/forms", icon: FolderKanban, group: "신청서" },
  { title: "거버넌스 요청 목록", href: "/governance/forms/list", icon: FileText, group: "신청서" },
  { title: "내 문서 목록", href: "/governance/forms/my", icon: FileText, group: "신청서" },
  { title: "거버넌스 요청 관리", href: "/governance/admin/forms", icon: FileCheck2, group: "신청서" },
  { title: "신청서 양식 카탈로그", href: "/governance/admin/forms-catalog", icon: FolderKanban, group: "신청서" },
  { title: "데이터 관리 정책", href: "/governance/policy", icon: BookOpen, group: "정책 & 감사" },
  { title: "제작·활용 프로세스", href: "/governance/process", icon: Workflow, group: "정책 & 감사" },
  { title: "Policy Templates", href: "/governance/templates", icon: ScrollText, group: "정책 & 감사" },
  { title: "Audit Trail", href: "/governance/audit", icon: ClipboardList, group: "정책 & 감사" },
  { title: "Compliance", href: "/governance/compliance", icon: ShieldCheck, group: "정책 & 감사" },
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
