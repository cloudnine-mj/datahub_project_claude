import Link from "next/link";
import { Brain, Database, FolderGit2, LayoutDashboard, Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Brain,
    title: "Models",
    description: "ML 모델 버전 관리, 메타데이터, 리니지 추적",
    href: "/models",
    color: "text-accent-blue",
    bg: "bg-blue-50",
  },
  {
    icon: Database,
    title: "Datasets",
    description: "데이터셋 브라우징, 프리뷰, 업로드, 버전 관리",
    href: "/datasets",
    color: "text-brand",
    bg: "bg-red-50",
  },
  {
    icon: FolderGit2,
    title: "Projects",
    description: "태스크, 실험, 팀 협업 프로젝트 관리",
    href: "/projects",
    color: "text-accent-purple",
    bg: "bg-purple-50",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "사용량, 활동, 트렌드 통계 대시보드",
    href: "/dashboard",
    color: "text-accent-green",
    bg: "bg-green-50",
  },
  {
    icon: Building2,
    title: "Organizations",
    description: "조직, 팀, 멤버, 권한 관리",
    href: "/organizations",
    color: "text-accent-orange",
    bg: "bg-orange-50",
  },
  {
    icon: ShieldCheck,
    title: "Governance",
    description: "승인 워크플로우, 정책, 감사 로그",
    href: "/governance",
    color: "text-accent-purple",
    bg: "bg-purple-50",
  },
];

interface HomeHeroProps {
  isLoggedIn: boolean;
}

export function HomeHero({ isLoggedIn }: HomeHeroProps) {
  return (
    <section className="border-b border-dh-border">
      {/* Hero Banner */}
      <div className="mx-auto max-w-[1440px] px-6 py-16 text-center">
        <h1 className="font-heading text-[40px] font-bold text-text-primary leading-tight">
          Explore <span className="text-brand">LGAIR</span> DataHub
        </h1>
        <p className="mt-4 text-lg text-text-secondary max-w-2xl mx-auto">
          AI/ML 데이터 자산을 한 곳에서 관리하세요. 버전 관리, 협업, 거버넌스를 통합 제공합니다.
        </p>
        {!isLoggedIn && (
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild className="bg-brand hover:bg-brand/90 text-white">
              <Link href="/login">시작하기</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/explore">탐색하기</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Feature Cards */}
      <div className="mx-auto max-w-[1440px] px-6 pb-16">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {features.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group flex flex-col items-center rounded-xl border border-dh-border bg-white p-5 text-center transition-all hover:border-brand/30 hover:shadow-sm"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${feature.bg}`}>
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>
              <h3 className="font-heading text-sm font-semibold text-text-primary">{feature.title}</h3>
              <p className="mt-1 text-xs text-text-secondary line-clamp-2">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
