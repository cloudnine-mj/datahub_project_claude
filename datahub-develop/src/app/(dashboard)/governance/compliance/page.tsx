import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

const stats = [
  {
    label: "전체 정책 준수율",
    value: "94.2%",
    delta: "+2.1%",
    icon: ShieldCheck,
    accent: "text-accent-green",
    bg: "bg-green-50",
  },
  {
    label: "검토 대기 요청",
    value: "15",
    delta: "+3 today",
    icon: Clock,
    accent: "text-accent-orange",
    bg: "bg-orange-50",
  },
  {
    label: "이번 분기 승인",
    value: "128",
    delta: "+18 vs Q1",
    icon: CheckCircle2,
    accent: "text-accent-blue",
    bg: "bg-blue-50",
  },
  {
    label: "위험 자산",
    value: "4",
    delta: "조치 필요",
    icon: AlertTriangle,
    accent: "text-brand",
    bg: "bg-red-50",
  },
];

const policies = [
  { name: "Model Release Approval", coverage: 98, total: 142 },
  { name: "Data Access Control", coverage: 95, total: 256 },
  { name: "Dataset Publishing", coverage: 91, total: 38 },
  { name: "Training Pipeline Review", coverage: 88, total: 64 },
];

const sensitivity = [
  { label: "Public", count: 124, color: "bg-accent-green" },
  { label: "Internal", count: 286, color: "bg-accent-blue" },
  { label: "Confidential", count: 92, color: "bg-accent-orange" },
  { label: "Restricted", count: 18, color: "bg-brand" },
];

const issues = [
  {
    severity: "high",
    title: "민감도 등급 미지정 데이터셋 4건",
    target: "lg-data/medical-records-2025 외 3건",
    href: "/datasets?filter=unclassified",
  },
  {
    severity: "medium",
    title: "결재 만료 임박 승인 2건",
    target: "GR-2026-0029, GR-2026-0031",
    href: "/governance",
  },
  {
    severity: "low",
    title: "정책 템플릿 검토 권장",
    target: "Training Pipeline Review (90일 미수정)",
    href: "/governance/templates",
  },
];

const severityBadge: Record<string, string> = {
  high: "bg-red-50 text-brand",
  medium: "bg-orange-50 text-accent-orange",
  low: "bg-blue-50 text-accent-blue",
};

export default function CompliancePage() {
  const totalAssets = sensitivity.reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-text-primary">
          Compliance Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          조직 단위 거버넌스·컴플라이언스 현황을 한눈에 확인하세요.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-start gap-3 rounded-xl border border-dh-border bg-white p-4"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.accent}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-secondary">{s.label}</p>
              <p className="font-heading text-2xl font-semibold text-text-primary">
                {s.value}
              </p>
              <p className={`mt-0.5 inline-flex items-center gap-1 text-xs ${s.accent}`}>
                <TrendingUp className="h-3 w-3" />
                {s.delta}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-dh-border bg-white p-5">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-text-primary">
              정책별 준수율
            </h2>
            <Link
              href="/governance/templates"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80"
            >
              템플릿 관리
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </header>
          <ul className="flex flex-col gap-4">
            {policies.map((p) => (
              <li key={p.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">{p.name}</span>
                  <span className="text-xs text-text-secondary">
                    {p.coverage}% · {p.total}건
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg-surface">
                  <div
                    className="h-full rounded-full bg-accent-green"
                    style={{ width: `${p.coverage}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-dh-border bg-white p-5">
          <header className="mb-4">
            <h2 className="font-heading text-base font-semibold text-text-primary">
              민감도 분류 분포
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              총 {totalAssets.toLocaleString()}개 자산 분류 현황
            </p>
          </header>
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full">
            {sensitivity.map((s) => (
              <div
                key={s.label}
                className={s.color}
                style={{ width: `${(s.count / totalAssets) * 100}%` }}
              />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {sensitivity.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-sm ${s.color}`} />
                <span className="text-sm text-text-primary">{s.label}</span>
                <span className="ml-auto text-xs text-text-secondary">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-dh-border bg-white p-5">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold text-text-primary">
              조치가 필요한 항목
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              컴플라이언스 점검 결과 즉시 검토가 필요한 항목입니다.
            </p>
          </div>
          <Link
            href="/governance/audit"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80"
          >
            감사 로그
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </header>
        <ul className="flex flex-col gap-2">
          {issues.map((iss) => (
            <li key={iss.title}>
              <Link
                href={iss.href}
                className="flex items-start gap-3 rounded-md border border-dh-border bg-bg-surface p-3 transition-colors hover:border-brand/30 hover:bg-white"
              >
                <span
                  className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${severityBadge[iss.severity]}`}
                >
                  {iss.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{iss.title}</p>
                  <p className="text-xs text-text-secondary">{iss.target}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
