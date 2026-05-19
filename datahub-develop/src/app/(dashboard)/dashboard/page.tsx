"use client";

import { useSession } from "@/components/session-provider";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Database } from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  myPlans: number;
  totalDatasets: number;
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  href: string;
  date: string;
  status: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    myPlans: 0,
    totalDatasets: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const plansRes = await fetch("/api/plans");
        const plansRaw = plansRes.ok ? await plansRes.json() : {};
        const plans = Array.isArray(plansRaw) ? plansRaw : plansRaw.data ?? [];

        const userId = (session?.user as any)?.id;
        const myPlans = plans.filter((p: any) => p.authorId === userId);

        setStats({
          myPlans: myPlans.length,
          totalDatasets: plans.filter((p: any) => p.status === "APPROVED").length,
        });

        const recent = plans
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8)
          .map((p: any) => ({
            id: p.id,
            type: "레포지토리",
            href: `/plans/${p.id}`,
            title: p.dataName,
            date: new Date(p.createdAt).toLocaleDateString("ko-KR"),
            status: p.status,
          }));
        setRecentActivity(recent);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchDashboardData();
    }
  }, [session]);

  const statCards = [
    {
      title: "내 레포지토리",
      value: stats.myPlans,
      description: "내가 생성한 레포지토리 수",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "내 데이터셋",
      value: stats.totalDatasets,
      description: "내가 만든 데이터셋 수",
      icon: Database,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  const statusLabel: Record<string, string> = {
    DRAFT: "작성 중",
    APPROVED: "제출 완료",
    IN_PROGRESS: "진행 중",
    COMPLETED: "완료",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">데이터를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">홈</h1>
        <p className="text-gray-500">
          안녕하세요, {session?.user?.name ?? "사용자"}님. 오늘의 현황입니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-gray-500 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>최근 활동</CardTitle>
          <CardDescription>최근 등록된 레포지토리</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              최근 활동 내역이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <Link key={activity.id} href={activity.href} className="block">
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-gray-500">
                          {activity.type} · {activity.date}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {statusLabel[activity.status] ?? activity.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
