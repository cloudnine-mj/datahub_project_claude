"use client";

import {
  Inbox,
  FileCheck2,
  FileText,
  BookOpen,
  Workflow,
  ScrollText,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { SectionNav, SectionNavItem } from "@/components/storyboard/section-nav";

const items: SectionNavItem[] = [
  { title: "Requests", href: "/governance", icon: Inbox, badge: 42, group: "요청 관리" },
  { title: "신청서 목록", href: "/governance/forms/list", icon: FileText, group: "요청 관리" },
  { title: "New Request", href: "/governance/new", icon: FileCheck2, group: "요청 관리" },
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
