import { ReactNode } from "react";
import { RepoSidebar } from "@/components/repo/repo-sidebar";
import { RepoBreadcrumb } from "@/components/repo/repo-breadcrumb";
import { RepoTabBar } from "@/components/repo/repo-tab-bar";

interface RepoLayoutProps {
  children: ReactNode;
  params: Promise<{ group: string; repo: string }>;
}

export default async function RepoLayout({ children, params }: RepoLayoutProps) {
  const { group, repo } = await params;
  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <RepoSidebar group={group} repo={repo} />
      <div className="flex flex-1 flex-col min-w-0">
        <RepoBreadcrumb group={group} repo={repo} />
        <RepoTabBar group={group} repo={repo} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
