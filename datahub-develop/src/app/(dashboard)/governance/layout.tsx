"use client";

import {
  Inbox,
  FileCheck2,
  ScrollText,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { SectionNav, SectionNavItem } from "@/components/storyboard/section-nav";

const items: SectionNavItem[] = [
  { title: "Requests", href: "/governance", icon: Inbox, badge: 42, group: "요청 관리" },
  { title: "New Request", href: "/governance/new", icon: FileCheck2, group: "요청 관리" },
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
