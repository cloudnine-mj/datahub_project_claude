"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Database,
  AlertCircle,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { MODALITY_COLORS } from "@/lib/catalog-types";
import ProjectDataTab from "@/components/dashboard/ProjectDataTab";
import RepositoryGraphTab from "@/components/dashboard/RepositoryGraphTab";
import type { TableInfo } from "@/lib/platform-client";

/* ── helpers ─────────────────────────────────────────── */

function countBy<T>(arr: T[], fn: (item: T) => string | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const key = fn(item) || "미지정";
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

function sorted(record: Record<string, number>): [string, number][] {
  return Object.entries(record).sort((a, b) => b[1] - a[1]);
}

/* ── types ───────────────────────────────────────────── */

interface FilterOptions {
  modalities: string[];
  tasks: string[];
  organizations: string[];
  data_card_tiers: string[];
}

interface Stats {
  total: number;
  byModality: Record<string, number>;
  byOrg: Record<string, number>;
  byTask: Record<string, number>;
  byTier: Record<string, number>;
}

/* ── bar component ───────────────────────────────────── */

const BAR_COLORS = [
  "bg-teal-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-orange-500",
];

function HorizontalBarChart({
  data,
  total,
}: {
  data: [string, number][];
  total: number;
}) {
  if (data.length === 0)
    return <p className="text-sm text-gray-400 py-4 text-center">데이터 없음</p>;

  return (
    <div className="space-y-3">
      {data.slice(0, 6).map(([label, count], i) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 font-medium truncate max-w-[60%]">{label}</span>
              <span className="text-gray-500 tabular-nums">{count}개 ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── donut chart ─────────────────────────────────────── */

const DONUT_COLORS = [
  "#14b8a6", "#3b82f6", "#a855f7", "#f59e0b",
  "#f43f5e", "#10b981", "#6366f1", "#f97316",
];

function DonutChart({
  data,
  total,
}: {
  data: [string, number][];
  total: number;
}) {
  if (total === 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        {data.map(([label, count], i) => {
          const pct = count / total;
          const offset = cumulative * circumference;
          cumulative += pct;
          return (
            <circle
              key={label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="20"
              strokeDasharray={`${pct * circumference} ${circumference}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
        })}
        <text x="60" y="56" textAnchor="middle" className="text-xl font-bold fill-gray-800">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" className="text-[10px] fill-gray-400">
          데이터셋
        </text>
      </svg>
      <div className="space-y-1.5 min-w-0">
        {data.slice(0, 5).map(([label, count], i) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="text-gray-600 truncate">{label}</span>
            <span className="text-gray-400 ml-auto tabular-nums">{count}</span>
          </div>
        ))}
        {data.length > 5 && (
          <p className="text-xs text-gray-400 pl-4.5">외 {data.length - 5}개</p>
        )}
      </div>
    </div>
  );
}

/* ── stat card ───────────────────────────────────────── */

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  bgColor,
}: {
  title: string;
  value: number | string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-gray-500 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

/* ── Data Assets Tab (기존 대시보드 내용) ────────────── */

function DataAssetsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/catalog/datasets");
        if (!res.ok) throw new Error("Failed to fetch datasets");
        const raw = await res.json();
        const list: TableInfo[] = Array.isArray(raw) ? raw : raw.data ?? [];

        setStats({
          total: list.length,
          byModality: countBy(list, (d) => d.properties?.modality),
          byOrg: countBy(list, (d) => d.properties?.organization),
          byTask: countBy(list, (d) => d.properties?.task),
          byTier: countBy(list, (d) => d.properties?.data_card_tier),
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 animate-pulse rounded bg-gray-100" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-48 animate-pulse rounded bg-gray-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <AlertCircle className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">
            {error || "데이터를 불러올 수 없습니다."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const modalityAssigned = stats.total - (stats.byModality["미지정"] || 0);
  const modalityData = sorted(stats.byModality).filter(([k]) => k !== "미지정");
  const orgData = sorted(stats.byOrg).filter(([k]) => k !== "미지정");
  const taskData = sorted(stats.byTask).filter(([k]) => k !== "미지정");
  const tierData = sorted(stats.byTier).filter(([k]) => k !== "미지정");

  return (
    <div className="space-y-4">
      {/* ── KPI Cards ──────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="전체 데이터셋"
          value={stats.total}
          sub="카탈로그에 등록된 총 수"
          icon={Database}
          color="text-teal-600"
          bgColor="bg-teal-50"
        />
        <StatCard
          title="Modality 유형"
          value={modalityData.length}
          sub={`${modalityAssigned}개 데이터셋에 지정됨`}
          icon={BarChart3}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatCard
          title="소속 조직"
          value={orgData.length}
          sub={`${orgData.reduce((s, [, c]) => s + c, 0)}개 데이터셋에 지정됨`}
          icon={TrendingUp}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
      </div>

      {/* ── Row 1: Modality donut + Org bar ────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modality 분포</CardTitle>
            <CardDescription>데이터 유형별 구성</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart data={modalityData} total={modalityData.reduce((s, [, c]) => s + c, 0)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">조직별 데이터셋</CardTitle>
            <CardDescription>Lab / Tech Cell 기준</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={orgData} total={stats.total} />
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Task bar + Tier bar ─────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task 분포</CardTitle>
            <CardDescription>데이터셋의 주요 활용 태스크</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={taskData} total={stats.total} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Card Tier</CardTitle>
            <CardDescription>데이터 카드 등급 분포</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart data={tierData} total={stats.total} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────── */

export default function DataDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 대시보드</h1>
        <p className="text-gray-500">카탈로그에 등록된 데이터셋의 전체 현황입니다.</p>
      </div>

      <Tabs defaultValue="data-assets">
        <TabsList>
          <TabsTrigger value="data-assets">데이터 자산</TabsTrigger>
          <TabsTrigger value="project-data">프로젝트 데이터</TabsTrigger>
          <TabsTrigger value="repo-graph">레포지토리 그래프</TabsTrigger>
        </TabsList>

        <TabsContent value="data-assets">
          <DataAssetsTab />
        </TabsContent>

        <TabsContent value="project-data">
          <ProjectDataTab />
        </TabsContent>

        <TabsContent value="repo-graph">
          <RepositoryGraphTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
