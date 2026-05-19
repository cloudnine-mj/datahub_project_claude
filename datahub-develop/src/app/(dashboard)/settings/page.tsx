import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, ChevronRight } from "lucide-react";

interface SettingsItem {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

// 추후 항목 추가 시 여기에만 푸시. (예: 알림, 프로필, 토큰 등)
const items: SettingsItem[] = [
  {
    href: "/settings/api-keys",
    title: "API Keys",
    description:
      "CLI · SDK · 외부 통합용 API 키를 발급·회전·revoke 합니다.",
    icon: KeyRound,
  },
];

export default function SettingsIndexPage() {
  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          개인 계정과 통합 설정을 관리합니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="block">
              <Card className="h-full transition-colors hover:border-brand">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </CardTitle>
                  <ChevronRight className="h-4 w-4 text-text-secondary" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-secondary">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
