"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  AlertCircle,
  Network,
  FilePlus,
  FileX,
  FileEdit,
} from "lucide-react";
import type {
  CommitInfo,
  BranchInfo,
  DiffEntryInfo,
  LineageNode,
  LineageEdge,
} from "@/lib/catalog-types";

/* ── types ───────────────────────────────────────────── */

interface CommitNode extends CommitInfo {
  branches: string[];
  lane: number;
}

/* ── constants ───────────────────────────────────────── */

const LANE_COLORS = [
  "#14b8a6", "#3b82f6", "#a855f7", "#f59e0b",
  "#f43f5e", "#10b981", "#6366f1", "#f97316",
];

const RELATION_LABELS: Record<string, string> = {
  derived_from: "파생",
  augmented_from: "증강",
  filtered_from: "필터링",
  merged_from: "병합",
};

const RELATION_COLORS: Record<string, string> = {
  derived_from: "#3b82f6",
  augmented_from: "#a855f7",
  filtered_from: "#f59e0b",
  merged_from: "#14b8a6",
};

const ROW_HEIGHT = 44;
const LANE_WIDTH = 24;
const NODE_RADIUS = 5;
const LEFT_PADDING = 16;

/* ── helper: relative time ───────────────────────────── */

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  return `${months}개월 전`;
}

/* ── Diff Panel ──────────────────────────────────────── */

function DiffPanel({ repo, commitId, parentIds }: { repo: string; commitId: string; parentIds: string[] }) {
  const [entries, setEntries] = useState<DiffEntryInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parentIds.length) { setLoading(false); return; }
    async function load() {
      try {
        const parentRef = parentIds[0];
        const res = await fetch(
          `/api/catalog/lakefs/${repo}/diff?from_ref=${encodeURIComponent(parentRef)}&to_ref=${encodeURIComponent(commitId)}`
        );
        if (res.ok) {
          const data = await res.json();
          setEntries(Array.isArray(data) ? data : []);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [repo, commitId, parentIds]);

  if (loading) return <div className="h-8 animate-pulse rounded bg-gray-100 mt-2" />;
  if (entries.length === 0) return <p className="text-xs text-gray-400 mt-2">변경 파일 없음</p>;

  const changeIcon = (type: string) => {
    if (type === "added") return <FilePlus className="h-3.5 w-3.5 text-green-600" />;
    if (type === "removed") return <FileX className="h-3.5 w-3.5 text-red-500" />;
    return <FileEdit className="h-3.5 w-3.5 text-amber-500" />;
  };

  const changeLabel = (type: string) => {
    if (type === "added") return "추가";
    if (type === "removed") return "삭제";
    return "수정";
  };

  return (
    <div className="mt-3 border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-600">
        변경 파일 ({entries.length})
      </div>
      <div className="divide-y max-h-[200px] overflow-y-auto">
        {entries.map((e) => (
          <div key={e.path} className="flex items-center gap-2 px-3 py-1.5 text-xs">
            {changeIcon(e.change_type)}
            <span className="flex-1 font-mono text-gray-700 truncate">{e.path}</span>
            <span className={`shrink-0 ${
              e.change_type === "added" ? "text-green-600" : e.change_type === "removed" ? "text-red-500" : "text-amber-600"
            }`}>
              {changeLabel(e.change_type)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Version Graph (single repo) ─────────────────────── */

function VersionGraph({ repo }: { repo: string }) {
  const [branchInfos, setBranchInfos] = useState<BranchInfo[]>([]);
  const [allCommits, setAllCommits] = useState<CommitNode[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [selectedCommit, setSelectedCommit] = useState<CommitNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repo) return;
    setLoading(true);
    setError(null);
    setSelectedCommit(null);

    async function load() {
      try {
        const brRes = await fetch(`/api/catalog/lakefs/${repo}/branches`);
        if (!brRes.ok) throw new Error("브랜치 목록을 불러올 수 없습니다.");
        const brData: BranchInfo[] = await brRes.json();
        setBranchInfos(brData);
        const branchNames = brData.map((b) => b.id);
        setSelectedBranches(new Set(branchNames));

        // branch HEAD commit IDs from API
        const branchHeads = new Map<string, string>();
        for (const b of brData) {
          if (b.commit_id) branchHeads.set(b.id, b.commit_id);
        }

        // fetch commits per branch
        const commitPromises = branchNames.map(async (branch) => {
          const res = await fetch(
            `/api/catalog/lakefs/${repo}/commits?ref=${encodeURIComponent(branch)}&amount=50`,
          );
          if (!res.ok) return { branch, commits: [] as CommitInfo[] };
          const commits: CommitInfo[] = await res.json();
          return { branch, commits };
        });

        const results = await Promise.all(commitPromises);

        // deduplicate and associate branches
        const commitMap = new Map<string, CommitNode>();

        // fallback: if API didn't give commit_id, use first commit
        for (const { branch, commits } of results) {
          if (!branchHeads.has(branch) && commits.length > 0) {
            branchHeads.set(branch, commits[0].id);
          }
          for (const c of commits) {
            if (commitMap.has(c.id)) {
              const existing = commitMap.get(c.id)!;
              if (!existing.branches.includes(branch)) {
                existing.branches.push(branch);
              }
            } else {
              commitMap.set(c.id, { ...c, branches: [branch], lane: 0 });
            }
          }
        }

        const sorted = Array.from(commitMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        // assign lanes
        const laneAssignment = new Map<string, number>();
        let nextLane = 0;
        if (branchNames.includes("main")) laneAssignment.set("main", nextLane++);

        for (const commit of sorted) {
          let primaryBranch = commit.branches[0];
          for (const b of commit.branches) {
            if (branchHeads.get(b) === commit.id && b !== "main") {
              primaryBranch = b;
              break;
            }
          }
          if (!laneAssignment.has(primaryBranch)) {
            laneAssignment.set(primaryBranch, nextLane++);
          }
          commit.lane = laneAssignment.get(primaryBranch)!;
        }

        setAllCommits(sorted);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [repo]);

  const toggleBranch = (branch: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branch)) next.delete(branch);
      else next.add(branch);
      return next;
    });
  };

  const visibleCommits = useMemo(() => {
    return allCommits.filter((c) => c.branches.some((b) => selectedBranches.has(b)));
  }, [allCommits, selectedBranches]);

  const totalLanes = useMemo(() => {
    const lanes = new Set(visibleCommits.map((c) => c.lane));
    return Math.max(lanes.size, 1);
  }, [visibleCommits]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-8">
        <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  const svgWidth = LEFT_PADDING + totalLanes * LANE_WIDTH + 16;

  return (
    <div className="space-y-4">
      {/* Branch filter with HEAD info */}
      <div className="flex flex-wrap gap-2">
        {branchInfos.map((br, i) => {
          const active = selectedBranches.has(br.id);
          const colorIdx = br.id === "main" ? 0 : (i % LANE_COLORS.length);
          return (
            <button
              key={br.id}
              onClick={() => toggleBranch(br.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                active ? "border-current text-white" : "border-gray-300 text-gray-400 bg-white"
              }`}
              style={active ? { backgroundColor: LANE_COLORS[colorIdx], borderColor: LANE_COLORS[colorIdx] } : {}}
              title={br.commit_message ? `HEAD: ${br.commit_message}` : undefined}
            >
              <GitBranch className="h-3 w-3" />
              {br.id}
              {br.commit_id && (
                <span className="opacity-70 font-mono">{br.commit_id.slice(0, 6)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Graph + commit list */}
      <div className="border rounded-md overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {visibleCommits.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <GitCommitHorizontal className="h-8 w-8 text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">커밋이 없습니다.</p>
            </div>
          ) : (
            <div className="relative">
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={svgWidth}
                height={visibleCommits.length * ROW_HEIGHT}
              >
                {Array.from(new Set(visibleCommits.map((c) => c.lane))).map((lane) => (
                  <line
                    key={`lane-${lane}`}
                    x1={LEFT_PADDING + lane * LANE_WIDTH}
                    y1={0}
                    x2={LEFT_PADDING + lane * LANE_WIDTH}
                    y2={visibleCommits.length * ROW_HEIGHT}
                    stroke={LANE_COLORS[lane % LANE_COLORS.length]}
                    strokeWidth={2}
                    opacity={0.2}
                  />
                ))}

                {visibleCommits.map((commit, idx) => {
                  const cx = LEFT_PADDING + commit.lane * LANE_WIDTH;
                  const cy = idx * ROW_HEIGHT + ROW_HEIGHT / 2;

                  return commit.parents.map((parentId) => {
                    const parentIdx = visibleCommits.findIndex((c) => c.id === parentId);
                    if (parentIdx === -1) return null;
                    const parent = visibleCommits[parentIdx];
                    const px = LEFT_PADDING + parent.lane * LANE_WIDTH;
                    const py = parentIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                    if (commit.lane === parent.lane) {
                      return (
                        <line
                          key={`${commit.id}-${parentId}`}
                          x1={cx} y1={cy} x2={px} y2={py}
                          stroke={LANE_COLORS[commit.lane % LANE_COLORS.length]}
                          strokeWidth={2}
                        />
                      );
                    }
                    return (
                      <path
                        key={`${commit.id}-${parentId}`}
                        d={`M ${cx} ${cy} C ${cx} ${cy + 20}, ${px} ${py - 20}, ${px} ${py}`}
                        fill="none"
                        stroke={LANE_COLORS[parent.lane % LANE_COLORS.length]}
                        strokeWidth={2}
                        opacity={0.6}
                      />
                    );
                  });
                })}

                {visibleCommits.map((commit, idx) => {
                  const cx = LEFT_PADDING + commit.lane * LANE_WIDTH;
                  const cy = idx * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const color = LANE_COLORS[commit.lane % LANE_COLORS.length];

                  return (
                    <g key={commit.id}>
                      {commit.isMerge ? (
                        <>
                          <circle cx={cx} cy={cy} r={NODE_RADIUS + 2} fill="white" stroke={color} strokeWidth={2} />
                          <circle cx={cx} cy={cy} r={NODE_RADIUS - 1} fill={color} />
                        </>
                      ) : (
                        <circle cx={cx} cy={cy} r={NODE_RADIUS} fill={color} />
                      )}
                    </g>
                  );
                })}
              </svg>

              {visibleCommits.map((commit) => (
                <div
                  key={commit.id}
                  className={`flex items-center hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedCommit?.id === commit.id ? "bg-blue-50" : ""
                  }`}
                  style={{ height: ROW_HEIGHT, paddingLeft: svgWidth + 8 }}
                  onClick={() => setSelectedCommit(selectedCommit?.id === commit.id ? null : commit)}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="flex gap-1 shrink-0">
                      {commit.branches.map((b) => {
                        const brInfo = branchInfos.find((bi) => bi.id === b);
                        const isHead = brInfo?.commit_id === commit.id;
                        if (!isHead) return null;
                        return (
                          <span
                            key={b}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: LANE_COLORS[commit.lane % LANE_COLORS.length] }}
                          >
                            <GitBranch className="h-2.5 w-2.5" />
                            {b}
                          </span>
                        );
                      })}
                    </div>
                    <span className="font-mono text-xs text-gray-500 shrink-0">{commit.shortId}</span>
                    {commit.isMerge && <GitMerge className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                    <span className="text-sm text-gray-800 truncate">{commit.message}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 pr-4">
                    <span className="text-xs text-gray-400 truncate max-w-[140px]">{commit.userEmail}</span>
                    <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">{relativeTime(commit.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Commit detail panel with diff */}
      {selectedCommit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">커밋 상세</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">커밋 ID</dt>
              <dd className="font-mono text-gray-800">{selectedCommit.id}</dd>
              <dt className="text-gray-500">메시지</dt>
              <dd className="text-gray-800">{selectedCommit.message}</dd>
              <dt className="text-gray-500">작성자</dt>
              <dd className="text-gray-800">{selectedCommit.userEmail || "—"}</dd>
              <dt className="text-gray-500">일시</dt>
              <dd className="text-gray-800">{new Date(selectedCommit.date).toLocaleString("ko-KR")}</dd>
              <dt className="text-gray-500">브랜치</dt>
              <dd className="flex gap-1">
                {selectedCommit.branches.map((b) => (
                  <span key={b} className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{b}</span>
                ))}
              </dd>
              <dt className="text-gray-500">부모 커밋</dt>
              <dd className="font-mono text-xs text-gray-600">
                {selectedCommit.parents.length > 0
                  ? selectedCommit.parents.map((p) => p.slice(0, 8)).join(", ")
                  : "없음 (초기 커밋)"}
              </dd>
              {selectedCommit.isMerge && (
                <>
                  <dt className="text-gray-500">타입</dt>
                  <dd>
                    <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                      <GitMerge className="h-3 w-3" /> 머지 커밋
                    </span>
                  </dd>
                </>
              )}
            </dl>
            {/* Diff */}
            <DiffPanel repo={repo} commitId={selectedCommit.id} parentIds={selectedCommit.parents} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Lineage DAG ─────────────────────────────────────── */

function LineageDAG() {
  const [nodes, setNodes] = useState<LineageNode[]>([]);
  const [edges, setEdges] = useState<LineageEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/lineage/graph");
        if (!res.ok) throw new Error("리니지 데이터를 불러올 수 없습니다.");
        const data = await res.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // compute layout: topological sort for positioning
  const layout = useMemo(() => {
    if (nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>(), width: 0, height: 0 };

    // build adjacency
    const children = new Map<string, string[]>();
    const parents = new Map<string, string[]>();
    const allNames = new Set(nodes.map((n) => n.repo_name));

    for (const e of edges) {
      if (!allNames.has(e.source) || !allNames.has(e.target)) continue;
      children.set(e.source, [...(children.get(e.source) || []), e.target]);
      parents.set(e.target, [...(parents.get(e.target) || []), e.source]);
    }

    // find roots (no parents)
    const roots = nodes.filter((n) => !(parents.get(n.repo_name)?.length));

    // BFS to assign levels
    const level = new Map<string, number>();
    const queue = roots.map((r) => r.repo_name);
    for (const r of queue) level.set(r, 0);

    let idx = 0;
    while (idx < queue.length) {
      const curr = queue[idx++];
      const currLevel = level.get(curr)!;
      for (const child of children.get(curr) || []) {
        const existing = level.get(child);
        if (existing === undefined || existing < currLevel + 1) {
          level.set(child, currLevel + 1);
        }
        if (!queue.includes(child)) queue.push(child);
      }
    }

    // nodes without edges
    for (const n of nodes) {
      if (!level.has(n.repo_name)) level.set(n.repo_name, 0);
    }

    // group by level
    const byLevel = new Map<number, string[]>();
    level.forEach((lvl, name) => {
      byLevel.set(lvl, [...(byLevel.get(lvl) || []), name]);
    });

    const nodeWidth = 160;
    const nodeHeight = 70;
    const hGap = 60;
    const vGap = 40;

    const positions = new Map<string, { x: number; y: number }>();
    let maxX = 0;
    let maxY = 0;

    const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    for (const lvl of sortedLevels) {
      const names = byLevel.get(lvl)!;
      const totalWidth = names.length * nodeWidth + (names.length - 1) * hGap;
      const startX = -totalWidth / 2;

      names.forEach((name, i) => {
        const x = startX + i * (nodeWidth + hGap) + totalWidth / 2;
        const y = lvl * (nodeHeight + vGap) + 40;
        positions.set(name, { x, y });
        maxX = Math.max(maxX, x + nodeWidth);
        maxY = Math.max(maxY, y + nodeHeight);
      });
    }

    return { positions, width: maxX + 80, height: maxY + 40 };
  }, [nodes, edges]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-8">
        <AlertCircle className="h-8 w-8 text-gray-300 mb-2" />
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16">
          <Network className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">데이터 리니지</h3>
          <p className="text-sm text-gray-400">등록된 리니지 관계가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const nodeWidth = 160;
  const nodeHeight = 70;

  // highlight path for selected node
  const highlightedEdges = new Set<string>();
  const highlightedNodes = new Set<string>();
  if (selectedNode) {
    highlightedNodes.add(selectedNode);
    // upstream
    const upQ = [selectedNode];
    let ui = 0;
    while (ui < upQ.length) {
      const curr = upQ[ui++];
      for (const e of edges) {
        if (e.target === curr && !highlightedNodes.has(e.source)) {
          highlightedNodes.add(e.source);
          highlightedEdges.add(`${e.source}-${e.target}`);
          upQ.push(e.source);
        }
      }
    }
    // downstream
    const downQ = [selectedNode];
    let di = 0;
    while (di < downQ.length) {
      const curr = downQ[di++];
      for (const e of edges) {
        if (e.source === curr && !highlightedNodes.has(e.target)) {
          highlightedNodes.add(e.target);
          highlightedEdges.add(`${e.source}-${e.target}`);
          downQ.push(e.target);
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {Object.entries(RELATION_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-6 h-0.5" style={{ backgroundColor: RELATION_COLORS[key] }} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-300" />
          <span>public</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" />
          <span>private</span>
        </div>
      </div>

      {/* DAG */}
      <div className="border rounded-md overflow-auto bg-gray-50" style={{ maxHeight: 500 }}>
        <svg width={layout.width} height={layout.height} className="min-w-full">
          {/* edges */}
          {edges.map((e) => {
            const from = layout.positions.get(e.source);
            const to = layout.positions.get(e.target);
            if (!from || !to) return null;

            const edgeKey = `${e.source}-${e.target}`;
            const highlighted = selectedNode ? highlightedEdges.has(edgeKey) : true;

            const x1 = from.x + nodeWidth / 2;
            const y1 = from.y + nodeHeight;
            const x2 = to.x + nodeWidth / 2;
            const y2 = to.y;
            const midY = (y1 + y2) / 2;

            return (
              <g key={edgeKey} opacity={highlighted ? 1 : 0.15}>
                <path
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={RELATION_COLORS[e.relation_type] || "#94a3b8"}
                  strokeWidth={2}
                />
                {/* arrowhead */}
                <polygon
                  points={`${x2},${y2} ${x2 - 4},${y2 - 8} ${x2 + 4},${y2 - 8}`}
                  fill={RELATION_COLORS[e.relation_type] || "#94a3b8"}
                />
                {/* label */}
                <text
                  x={(x1 + x2) / 2}
                  y={midY - 4}
                  textAnchor="middle"
                  className="text-[9px] fill-gray-400"
                >
                  {RELATION_LABELS[e.relation_type] || e.relation_type}
                </text>
              </g>
            );
          })}

          {/* nodes */}
          {nodes.map((n) => {
            const pos = layout.positions.get(n.repo_name);
            if (!pos) return null;

            const highlighted = selectedNode ? highlightedNodes.has(n.repo_name) : true;
            const isPrivate = n.visibility === "private";

            return (
              <g
                key={n.repo_name}
                opacity={highlighted ? 1 : 0.2}
                className="cursor-pointer"
                onClick={() => setSelectedNode(selectedNode === n.repo_name ? null : n.repo_name)}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={8}
                  fill={selectedNode === n.repo_name ? "#e0f2fe" : "white"}
                  stroke={isPrivate ? "#f59e0b" : "#14b8a6"}
                  strokeWidth={selectedNode === n.repo_name ? 2 : 1}
                />
                <text
                  x={pos.x + nodeWidth / 2}
                  y={pos.y + 28}
                  textAnchor="middle"
                  className="text-xs font-medium fill-gray-800"
                >
                  {n.repo_name.length > 18 ? n.repo_name.slice(0, 16) + "…" : n.repo_name}
                </text>
                <text
                  x={pos.x + nodeWidth / 2}
                  y={pos.y + 44}
                  textAnchor="middle"
                  className="text-[10px] fill-gray-400"
                >
                  {n.owner?.split("@")[0] || "—"}
                </text>
                <text
                  x={pos.x + nodeWidth / 2}
                  y={pos.y + 58}
                  textAnchor="middle"
                  className="text-[9px] fill-gray-400"
                >
                  {isPrivate ? "private" : "public"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">{selectedNode}</span>의 upstream/downstream 경로가 하이라이트됩니다. 다시 클릭하면 해제됩니다.
        </p>
      )}
    </div>
  );
}

/* ── Main Tab Component ──────────────────────────────── */

export default function RepositoryGraphTab() {
  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("version-graph");

  useEffect(() => {
    async function loadRepos() {
      try {
        const res = await fetch("/api/plans?pageSize=9999");
        if (!res.ok) return;
        const data = await res.json();
        const plans = data.data ?? [];
        const unique = Array.from(new Set<string>(plans.map((p: any) => p.dataName)));
        setRepos(unique.sort());
        if (unique.length > 0) setSelectedRepo(unique[0]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadRepos();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="h-48 animate-pulse rounded bg-gray-100" />
        </CardContent>
      </Card>
    );
  }

  if (repos.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16">
          <Network className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">레포지토리 그래프</h3>
          <p className="text-sm text-gray-400">등록된 레포지토리가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="version-graph">버전 그래프</TabsTrigger>
            <TabsTrigger value="data-lineage">데이터 리니지</TabsTrigger>
          </TabsList>

          {/* Repo selector — only for version graph */}
          {activeTab === "version-graph" && (
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {repos.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>

        <TabsContent value="version-graph">
          {selectedRepo && <VersionGraph repo={selectedRepo} />}
        </TabsContent>

        <TabsContent value="data-lineage">
          <LineageDAG />
        </TabsContent>
      </Tabs>
    </div>
  );
}
