import { redirect } from "next/navigation";
import { getPlatformToken } from "@/lib/session";
import { Header } from "@/components/layout/header";
import AgentChat from "@/components/chat/agent-chat";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getPlatformToken();

  if (!token) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-surface">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <AgentChat />
    </div>
  );
}
