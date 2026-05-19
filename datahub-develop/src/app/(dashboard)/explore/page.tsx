import Link from "next/link";
import {
  Brain,
  Database,
  FolderGit2,
  LayoutDashboard,
  ShieldCheck,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { PageShell } from "@/components/storyboard/page-shell";

const sections = [
  {
    icon: Database,
    title: "Dataset Repository",
    description:
      "데이터 미리보기, 검증, 리니지 추적과 함께 데이터셋을 저장·버전 관리·탐색하세요.",
    href: "/datasets",
    accent: "bg-red-50 text-brand",
  },
  {
    icon: Brain,
    title: "Model Repository",
    description:
      "버전 관리, 모델 카드, 협업 도구가 포함된 AI/ML 모델을 발견·공유·관리하세요.",
    href: "/models",
    accent: "bg-blue-50 text-accent-blue",
  },
  {
    icon: FolderGit2,
    title: "Projects",
    description:
      "이슈 트래킹과 팀 워크플로우로 모델·데이터셋을 협업 프로젝트로 묶어 관리하세요.",
    href: "/projects",
    accent: "bg-purple-50 text-accent-purple",
  },
  {
    icon: LayoutDashboard,
    title: "Personal Dashboard",
    description:
      "기여 활동, 모델 성능, 개인 워크스페이스를 한눈에 확인하세요.",
    href: "/dashboard",
    accent: "bg-green-50 text-accent-green",
  },
  {
    icon: ShieldCheck,
    title: "Policy & Governance",
    description:
      "데이터 거버넌스 정책, 컴플라이언스, 접근 제어를 정의하고 시행하세요.",
    href: "/governance",
    accent: "bg-orange-50 text-accent-orange",
  },
  {
    icon: BarChart3,
    title: "Enterprise Analytics",
    description:
      "조직 단위의 모델 사용량, 데이터셋 채택, 스토리지 지표, 팀 활동 인사이트.",
    href: "/analytics",
    accent: "bg-blue-50 text-accent-blue",
  },
];

const popularSearches = [
  { label: "Korean BERT", href: "/models?q=korean-bert" },
  { label: "Air Quality Sensors", href: "/datasets?q=air-quality" },
  { label: "Object Detection", href: "/models?q=object-detection" },
  { label: "Speech Recognition", href: "/datasets?q=speech-recognition" },
  { label: "Vehicle OS Logs", href: "/datasets?q=vehicle-os" },
];

export default function ExplorePage() {
  return (
    <PageShell
      breadcrumbs={[{ label: "Explore" }]}
      title="Explore LGAIR DataHub"
      description="데이터셋, 모델, 프로젝트를 빠르게 탐색하고 시작 지점을 찾으세요."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex flex-col rounded-xl border border-dh-border bg-white p-5 transition-all hover:border-brand/30 hover:shadow-sm"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${section.accent}`}
            >
              <section.icon className="h-5 w-5" />
            </div>
            <h3 className="font-heading text-base font-semibold text-text-primary">
              {section.title}
            </h3>
            <p className="mt-1 flex-1 text-sm text-text-secondary line-clamp-3">
              {section.description}
            </p>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-brand">
              Explore
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-10 rounded-xl border border-dh-border bg-bg-surface p-6">
        <h2 className="font-heading text-sm font-semibold text-text-primary">
          인기 검색어
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {popularSearches.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="rounded-full border border-dh-border bg-white px-3 py-1 text-xs text-text-secondary transition-colors hover:border-brand/30 hover:text-brand"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
