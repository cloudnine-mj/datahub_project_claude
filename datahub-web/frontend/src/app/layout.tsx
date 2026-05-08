import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "LG AI DataHub — Governance",
  description: "데이터 거버넌스 정책 및 프로세스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col">
            <Topbar />
            <main className="flex-1 bg-gray-50/40">
              <div className="mx-auto max-w-7xl px-10 py-8">{children}</div>
            </main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
