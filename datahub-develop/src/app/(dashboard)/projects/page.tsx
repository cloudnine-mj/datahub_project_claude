import Link from "next/link";
import {
  FolderGit2,
  GitBranch,
  Brain,
  Database,
  Plus,
  Activity,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/storyboard/page-shell";

const projects = [
  {
    slug: "exaone-3.5-release",
    name: "EXAONE 3.5 Release",
    group: "lg-research",
    description: "EXAONE 3.5 Korean LLM 분기 릴리즈 — 평가, QA, 모델 카드 정비",
    status: "In Progress",
    models: 3,
    datasets: 5,
    contributors: 12,
    accent: "bg-red-50 text-brand",
    statusColor: "bg-blue-50 text-accent-blue",
  },
  {
    slug: "indoor-air-pilot",
    name: "Indoor Air Quality Pilot",
    group: "lg-air-science",
    description: "스마트홈 1,200개 디바이스 대상 공기질 예측 PoC",
    status: "Review",
    models: 2,
    datasets: 3,
    contributors: 6,
    accent: "bg-blue-50 text-accent-blue",
    statusColor: "bg-orange-50 text-accent-orange",
  },
  {
    slug: "vehicle-os-nlu",
    name: "Vehicle OS NLU",
    group: "lg-vehicle-os",
    description: "차량용 음성 NLU 개선 — 한국어 컨텍스트 인식 강화",
    status: "Planning",
    models: 1,
    datasets: 4,
    contributors: 5,
    accent: "bg-purple-50 text-accent-purple",
    statusColor: "bg-bg-surface text-text-secondary",
  },
  {
    slug: "polymer-property-v1",
    name: "Polymer Property Predictor v1",
    group: "lg-chem-ai",
    description: "신소재 폴리머 특성 예측 모델 첫 프로덕션 릴리즈",
    status: "Review",
    models: 1,
    datasets: 2,
    contributors: 4,
    accent: "bg-orange-50 text-accent-orange",
    statusColor: "bg-orange-50 text-accent-orange",
  },
];

const collections = [
  { name: "Korean NLP Suite", count: 12, group: "lg-research" },
  { name: "Vision Inspection", count: 8, group: "lg-display" },
  { name: "Sensor Fusion", count: 6, group: "lg-vehicle-os" },
  { name: "Smart Home AI", count: 9, group: "lg-air-science" },
];

export default function ProjectsPage() {
  return (
    <PageShell
      breadcrumbs={[{ label: "Projects" }]}
      title="Projects & Collections"
      description="모델·데이터셋·이슈를 묶어 팀 단위 워크플로우로 관리하세요."
      actions={
        <Button size="sm" className="bg-brand text-white hover:bg-brand/90">
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Project
        </Button>
      }
    >
      <section className="mb-8">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-text-primary">
            Active Projects
          </h2>
          <Link href="/dashboard" className="text-xs text-text-secondary hover:text-text-primary">
            전체 활동 보기 →
          </Link>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <article
              key={p.slug}
              className="flex flex-col rounded-xl border border-dh-border bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${p.accent}`}>
                  <FolderGit2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${p.slug}`}
                    className="font-heading text-base font-semibold text-text-primary hover:text-brand"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-text-muted font-mono">{p.group}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.statusColor}`}
                >
                  {p.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-text-secondary line-clamp-2">{p.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-dh-border pt-3 text-xs text-text-secondary">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Brain className="h-3.5 w-3.5" /> {p.models}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Database className="h-3.5 w-3.5" /> {p.datasets}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {p.contributors}
                  </span>
                </div>
                <Link
                  href={`/projects/${p.slug}`}
                  className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand/80"
                >
                  Open
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-text-primary">
            Collections
          </h2>
          <Link
            href="/explore"
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            모두 보기 →
          </Link>
        </header>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {collections.map((c) => (
            <Link
              key={c.name}
              href={`/projects/collections/${encodeURIComponent(c.name)}`}
              className="rounded-xl border border-dh-border bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-accent-blue" />
                <h3 className="font-heading text-sm font-semibold text-text-primary">
                  {c.name}
                </h3>
              </div>
              <p className="mt-1 text-xs text-text-muted">{c.group}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-text-secondary">
                <Activity className="h-3 w-3" /> {c.count}개 자산
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
