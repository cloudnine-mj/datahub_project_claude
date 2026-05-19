import Link from "next/link";
import {
  Building2,
  Users,
  Database,
  Brain,
  Plus,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/storyboard/page-shell";

const organizations = [
  {
    slug: "lg-research",
    name: "LG AI Research",
    description: "EXAONE 등 LG 그룹 차세대 AI 모델 연구 조직",
    members: 28,
    models: 42,
    datasets: 36,
    color: "bg-red-50 text-brand",
    leaders: ["Sanghyun Seo", "Jieun Kim", "Minjun Park"],
  },
  {
    slug: "lg-air-science",
    name: "LG Air Science Lab",
    description: "공기/환경 데이터 기반 헬스케어·스마트홈 AI",
    members: 8,
    models: 12,
    datasets: 34,
    color: "bg-blue-50 text-accent-blue",
    leaders: ["Soyeon Choi"],
  },
  {
    slug: "lg-thinq-lab",
    name: "LG ThinQ Lab",
    description: "스마트가전·IoT 디바이스 AI 응용 연구",
    members: 15,
    models: 24,
    datasets: 56,
    color: "bg-green-50 text-accent-green",
    leaders: ["Jieun Kim"],
  },
  {
    slug: "lg-vehicle-os",
    name: "LG Vehicle OS",
    description: "차량용 OS 및 인포테인먼트 AI 모듈",
    members: 6,
    models: 9,
    datasets: 18,
    color: "bg-purple-50 text-accent-purple",
    leaders: ["Minjun Park"],
  },
  {
    slug: "lg-chem-ai",
    name: "LG Chem AI",
    description: "신소재 특성 예측 및 합성 경로 탐색",
    members: 11,
    models: 18,
    datasets: 22,
    color: "bg-orange-50 text-accent-orange",
    leaders: ["Jieun Kim"],
  },
  {
    slug: "lg-display",
    name: "LG Display Vision",
    description: "디스플레이 결함 검사·생산 비전 AI",
    members: 9,
    models: 15,
    datasets: 28,
    color: "bg-blue-50 text-accent-blue",
    leaders: ["Soyeon Choi"],
  },
];

export default function OrganizationsPage() {
  return (
    <PageShell
      breadcrumbs={[{ label: "Organizations" }]}
      title="Organizations"
      description="LG 그룹 내 데이터·AI 조직 단위로 자산을 관리하고 협업하세요."
      actions={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input placeholder="조직 검색..." className="h-9 w-56 pl-8" />
          </div>
          <Button size="sm" className="bg-brand text-white hover:bg-brand/90">
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Organization
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <article
            key={org.slug}
            className="flex flex-col rounded-xl border border-dh-border bg-white p-5 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${org.color}`}
              >
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/organizations/${org.slug}`}
                  className="font-heading text-base font-semibold text-text-primary hover:text-brand"
                >
                  {org.name}
                </Link>
                <p className="text-xs text-text-muted font-mono">{org.slug}</p>
              </div>
            </div>

            <p className="mt-3 text-sm text-text-secondary line-clamp-2">{org.description}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md bg-bg-surface p-2 text-center">
                <Brain className="mx-auto h-3.5 w-3.5 text-accent-blue" />
                <p className="mt-1 font-semibold text-text-primary">{org.models}</p>
                <p className="text-text-muted">Models</p>
              </div>
              <div className="rounded-md bg-bg-surface p-2 text-center">
                <Database className="mx-auto h-3.5 w-3.5 text-brand" />
                <p className="mt-1 font-semibold text-text-primary">{org.datasets}</p>
                <p className="text-text-muted">Datasets</p>
              </div>
              <div className="rounded-md bg-bg-surface p-2 text-center">
                <Users className="mx-auto h-3.5 w-3.5 text-accent-purple" />
                <p className="mt-1 font-semibold text-text-primary">{org.members}</p>
                <p className="text-text-muted">Members</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-dh-border pt-4">
              <div className="flex -space-x-1">
                {org.leaders.slice(0, 3).map((name, idx) => (
                  <span
                    key={idx}
                    title={name}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-bg-surface text-[10px] font-semibold text-text-primary"
                  >
                    {name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </span>
                ))}
              </div>
              <Link
                href={`/datasets?org=${org.slug}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80"
              >
                탐색
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
