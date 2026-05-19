"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  FolderKanban,
  Database,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { MODALITY_COLORS } from "@/lib/catalog-types";
import type { TableInfo } from "@/lib/platform-client";

/* ── types ───────────────────────────────────────────── */

interface ProjectInfo {
  id: string;
  name: string;
  pmsCode?: string | null;
  status: string;
  pmLeader?: { name: string | null } | null;
  tmLeader?: { name: string | null } | null;
  lab?: { name: string } | null;
  _count?: { plans: number; reports: number };
}

interface PlanInfo {
  id: string;
  dataName: string;
  modality: string;
  status: string;
  projectId: string;
  createdAt: string;
  project?: { name: string } | null;
  author?: { name: string | null; email: string } | null;
}

interface RepoStatsInfo {
  repo_name: string;
  visibility: string;
  branch_count: number;
  commit_count: number;
  file_count: number;
  data_size: string;
  data_count: string;
  data_card_tier: string;
  last_commit_message: string;
  last_commit_date: number;
}

interface EnrichedPlan extends PlanInfo {
  dataSize?: string | null;
  dataCount?: string | null;
  repoStats?: RepoStatsInfo | null;
}

interface ProjectGroup {
  project: ProjectInfo;
  plans: EnrichedPlan[];
}

/* ── constants ───────────────────────────────────────── */

const PLAN_STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-teal-100 text-teal-700",
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "초안",
  SUBMITTED: "제출됨",
  APPROVED: "승인됨",
  REJECTED: "반려",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
};

const PROJECT_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-teal-100 text-teal-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "활성",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CANCELLED: "취소",
};

/* ── component ───────────────────────────────────────── */

export default function ProjectDataTab() {
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    async function load() {
      try {
        const [projRes, planRes, catalogRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/plans?pageSize=9999"),
          fetch("/api/catalog/datasets"),
        ]);

        if (!projRes.ok || !planRes.ok) throw new Error("데이터를 불러올 수 없습니다.");

        const projects: ProjectInfo[] = await projRes.json();
        const planData = await planRes.json();
        const plans: PlanInfo[] = planData.data ?? [];

        let catalog: TableInfo[] = [];
        if (catalogRes.ok) {
          const raw = await catalogRes.json();
          catalog = Array.isArray(raw) ? raw : raw.data ?? [];
        }

        // catalog lookup: underscore table_name → TableInfo
        const catalogMap = new Map<string, TableInfo>();
        for (const t of catalog) {
          if (t.table_name) catalogMap.set(t.table_name, t);
        }

        // fetch repo stats in parallel (best effort)
        const statsPromises = plans.map(async (p) => {
          try {
            const res = await fetch(`/api/catalog/lakefs/${p.dataName}/stats`);
            if (res.ok) return { dataName: p.dataName, stats: await res.json() as RepoStatsInfo };
          } catch { /* ignore */ }
          return { dataName: p.dataName, stats: null };
        });
        const statsResults = await Promise.all(statsPromises);
        const statsMap = new Map<string, RepoStatsInfo>();
        for (const { dataName, stats } of statsResults) {
          if (stats) statsMap.set(dataName, stats);
        }

        // enrich plans with catalog + stats data
        const enrichedPlans: EnrichedPlan[] = plans.map((p) => {
          const tableName = p.dataName.replace(/-/g, "_");
          const tableInfo = catalogMap.get(tableName);
          const repoStats = statsMap.get(p.dataName) || null;
          return {
            ...p,
            dataSize: repoStats?.data_size || tableInfo?.properties?.data_size || null,
            dataCount: repoStats?.data_count || tableInfo?.properties?.data_count || null,
            repoStats,
          };
        });

        // group by project
        const projectMap = new Map<string, ProjectInfo>();
        for (const proj of projects) projectMap.set(proj.id, proj);

        const plansByProject = new Map<string, EnrichedPlan[]>();
        for (const plan of enrichedPlans) {
          const list = plansByProject.get(plan.projectId) || [];
          list.push(plan);
          plansByProject.set(plan.projectId, list);
        }

        const result: ProjectGroup[] = projects
          .filter((proj) => plansByProject.has(proj.id))
          .map((proj) => ({
            project: proj,
            plans: plansByProject.get(proj.id)!,
          }));

        setGroups(result);
        // expand first project by default
        if (result.length > 0) {
          setExpandedProjects(new Set([result[0].project.id]));
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-24 animate-pulse rounded bg-gray-100" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12">
          <AlertCircle className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // filtering
  const filtered = groups
    .filter((g) => {
      if (statusFilter !== "ALL" && g.project.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchProject = g.project.name.toLowerCase().includes(q);
        const matchPlan = g.plans.some((p) => p.dataName.toLowerCase().includes(q));
        return matchProject || matchPlan;
      }
      return true;
    });

  const totalPlans = filtered.reduce((s, g) => s + g.plans.length, 0);
  const completedPlans = filtered.reduce(
    (s, g) => s + g.plans.filter((p) => p.status === "COMPLETED").length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">프로젝트</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filtered.length}</div>
            <p className="text-xs text-gray-500 mt-1">데이터가 있는 프로젝트</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">레포지토리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPlans}</div>
            <p className="text-xs text-gray-500 mt-1">전체 데이터 기획</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">완료율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0}%
            </div>
            <p className="text-xs text-gray-500 mt-1">{completedPlans}/{totalPlans} 완료</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="프로젝트 또는 레포지토리 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="ALL">전체 상태</option>
          <option value="ACTIVE">활성</option>
          <option value="COMPLETED">완료</option>
          <option value="ON_HOLD">보류</option>
          <option value="CANCELLED">취소</option>
        </select>
      </div>

      {/* Project groups */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FolderKanban className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">조건에 맞는 프로젝트가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        filtered.map((group) => {
          const expanded = expandedProjects.has(group.project.id);
          return (
            <Card key={group.project.id}>
              <CardHeader
                className="cursor-pointer select-none hover:bg-gray-50 transition-colors"
                onClick={() => toggleProject(group.project.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{group.project.name}</CardTitle>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            PROJECT_STATUS_STYLES[group.project.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {PROJECT_STATUS_LABELS[group.project.status] || group.project.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[
                          group.project.pmsCode && `PMS: ${group.project.pmsCode}`,
                          group.project.pmLeader?.name && `PM: ${group.project.pmLeader.name}`,
                          group.project.lab?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        {" · "}
                        레포 {group.plans.length}개
                      </p>
                    </div>
                  </div>
                  {/* mini progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all"
                        style={{
                          width: `${
                            group.plans.length > 0
                              ? (group.plans.filter((p) => p.status === "COMPLETED").length /
                                  group.plans.length) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums w-8">
                      {group.plans.length > 0
                        ? Math.round(
                            (group.plans.filter((p) => p.status === "COMPLETED").length /
                              group.plans.length) *
                              100,
                          )
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </CardHeader>
              {expanded && (
                <CardContent className="pt-0">
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">레포지토리</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Modality</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">상태</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">공개</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">데이터 크기</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">파일</th>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">담당자</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.plans.map((plan) => (
                          <tr key={plan.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Database className="h-3.5 w-3.5 text-gray-400" />
                                <span className="font-medium text-gray-800">{plan.dataName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                                  MODALITY_COLORS[plan.modality] || "bg-gray-100 text-gray-700 border-gray-300"
                                }`}
                              >
                                {plan.modality}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  PLAN_STATUS_STYLES[plan.status] || "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {PLAN_STATUS_LABELS[plan.status] || plan.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {plan.repoStats ? (
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    plan.repoStats.visibility === "private"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-teal-100 text-teal-700"
                                  }`}
                                >
                                  {plan.repoStats.visibility === "private" ? "비공개" : "공개"}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                              {plan.dataSize || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                              {plan.repoStats ? `${plan.repoStats.file_count}개` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600">
                              {plan.author?.name || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
