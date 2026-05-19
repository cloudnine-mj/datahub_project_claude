import {
  Brain,
  Database,
  FolderGit2,
  LayoutDashboard,
  Building2,
  ShieldCheck,
  BarChart3,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const mainNavItems: NavItem[] = [
  { title: "Models", href: "/models", icon: Brain },
  { title: "Datasets", href: "/datasets", icon: Database },
  { title: "Projects", href: "/projects", icon: FolderGit2 },
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Organizations", href: "/organizations", icon: Building2 },
  { title: "Governance", href: "/governance", icon: ShieldCheck },
];
