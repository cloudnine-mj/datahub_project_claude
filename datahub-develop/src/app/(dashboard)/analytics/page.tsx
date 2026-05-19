"use client";

import Link from "next/link";
import {
  TrendingUp,
  Users,
  Database,
  Brain,
  HardDrive,
  Building2,
  Activity,
  ShieldAlert,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageShell } from "@/components/storyboard/page-shell";

const overviewKpis = [
  { label: "Total Models", value: "186", delta: "+24 this Q", icon: Brain, color: "text-accent-blue", bg: "bg-blue-50" },
  { label: "Total Datasets", value: "428", delta: "+31 this Q", icon: Database, color: "text-brand", bg: "bg-red-50" },
  { label: "Active Members", value: "112", delta: "+9 this month", icon: Users, color: "text-accent-purple", bg: "bg-purple-50" },
  { label: "Storage", value: "84.2 TB", delta: "62% used", icon: HardDrive, color: "text-accent-orange", bg: "bg-orange-50" },
];

const orgs = [
  { name: "LG AI Research", slug: "lg-research", models: 42, datasets: 36, members: 28 },
  { name: "LG ThinQ Lab", slug: "lg-thinq-lab", models: 24, datasets: 56, members: 15 },
  { name: "LG Air Science", slug: "lg-air-science", models: 12, datasets: 34, members: 8 },
  { name: "LG Vehicle OS", slug: "lg-vehicle-os", models: 9, datasets: 18, members: 6 },
  { name: "LG Display Vision", slug: "lg-display", models: 15, datasets: 28, members: 9 },
  { name: "LG Chem AI", slug: "lg-chem-ai", models: 18, datasets: 22, members: 11 },
];

const trends = [
  { label: "Pull / month", value: "12.4M", delta: "+18%" },
  { label: "Active Repositories", value: "248", delta: "+12" },
  { label: "API Calls / day", value: "428k", delta: "+22%" },
  { label: "Avg. PR Merge Time", value: "1.4d", delta: "-0.3d" },
];

const activeMembers = [
  { name: "Jieun Kim", email: "jieun.kim@lgair.com", role: "Admin", initials: "JK" },
  { name: "Minjun Park", email: "minjun.park@lgair.com", role: "Write", initials: "MP" },
  { name: "Soyeon Choi", email: "soyeon.choi@lgair.com", role: "Read", initials: "SC" },
  { name: "Sanghyun Seo", email: "sanghyun.seo@lgair.com", role: "Admin", initials: "SS" },
];

const quality = [
  { label: "메타데이터 충실도", score: 92, color: "bg-accent-green" },
  { label: "리니지 추적", score: 78, color: "bg-accent-blue" },
  { label: "스키마 검증 통과", score: 88, color: "bg-accent-purple" },
  { label: "민감도 분류", score: 95, color: "bg-accent-orange" },
];

export default function AnalyticsPage() {
  return (
    <PageShell
      breadcrumbs={[{ label: "Analytics" }]}
      title="Enterprise Analytics"
      description="조직 단위의 모델 사용량, 데이터셋 채택, 스토리지 지표, 팀 활동 인사이트."
    >
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-bg-surface">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="org">Organizations</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
          <TabsTrigger value="activity">User Activity</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewKpis.map((k) => (
              <div
                key={k.label}
                className="flex items-start gap-3 rounded-xl border border-dh-border bg-white p-4"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${k.bg}`}>
                  <k.icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <div>
                  <p className="text-xs text-text-secondary">{k.label}</p>
                  <p className="font-heading text-2xl font-semibold text-text-primary">{k.value}</p>
                  <p className={`mt-0.5 inline-flex items-center gap-1 text-xs ${k.color}`}>
                    <TrendingUp className="h-3 w-3" />
                    {k.delta}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-dh-border bg-white p-5">
              <h3 className="font-heading text-base font-semibold text-text-primary">
                Top Repositories (Q2)
              </h3>
              <ol className="mt-3 flex flex-col gap-2 text-sm">
                {[
                  { rank: 1, name: "lg-research/exaone-3.5-instruct", pulls: "2.4k" },
                  { rank: 2, name: "lg-air-science/air-quality-predictor", pulls: "1.8k" },
                  { rank: 3, name: "lg-chem-ai/polymer-property-model", pulls: "1.2k" },
                  { rank: 4, name: "lg-display/oled-inspection-images", pulls: "0.9k" },
                ].map((r) => (
                  <li
                    key={r.rank}
                    className="flex items-center gap-3 rounded-md border border-dh-border bg-bg-surface px-3 py-2"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-semibold text-text-primary">
                      {r.rank}
                    </span>
                    <span className="flex-1 truncate text-text-primary">{r.name}</span>
                    <span className="text-xs text-text-secondary">{r.pulls} pulls</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-dh-border bg-white p-5">
              <h3 className="font-heading text-base font-semibold text-text-primary">
                최근 조직 활동
              </h3>
              <ul className="mt-3 flex flex-col gap-3 text-sm">
                {[
                  { who: "lg-research", what: "exaone-3.5-instruct 1.2.0 release 요청 생성", when: "2h ago" },
                  { who: "lg-air-science", what: "indoor-air-quality-2024 2,400 객체 업로드", when: "5h ago" },
                  { who: "lg-vehicle-os", what: "vehicle-os-nlu 프로젝트 신규 멤버 2명 추가", when: "1d ago" },
                  { who: "lg-display", what: "oled-inspection-images PR #38 머지", when: "1d ago" },
                ].map((row, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 text-accent-blue" />
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary">
                        <span className="font-mono text-xs text-text-muted">{row.who}</span> {row.what}
                      </p>
                      <p className="text-xs text-text-muted">{row.when}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="org" className="mt-6">
          <div className="overflow-hidden rounded-xl border border-dh-border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-bg-surface text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Models</th>
                  <th className="px-4 py-3">Datasets</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dh-border">
                {orgs.map((o) => (
                  <tr key={o.slug} className="hover:bg-bg-surface/50">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">{o.name}</span>
                        <span className="text-xs font-mono text-text-muted">{o.slug}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-primary">{o.models}</td>
                    <td className="px-4 py-3 text-text-primary">{o.datasets}</td>
                    <td className="px-4 py-3 text-text-primary">{o.members}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/organizations`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80"
                      >
                        보기
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="metadata" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Modality 분포", values: ["Tabular 38%", "Image 27%", "Text 19%", "Audio 12%", "Multi-modal 4%"] },
              { label: "라이센스 분포", values: ["MIT 42%", "Apache-2.0 31%", "Internal 18%", "CC-BY 6%", "기타 3%"] },
              { label: "Top Tags", values: ["#korean (124)", "#sensor (98)", "#vision (76)", "#nlp (54)", "#energy (41)"] },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-dh-border bg-white p-4">
                <h4 className="font-heading text-sm font-semibold text-text-primary">{card.label}</h4>
                <ul className="mt-3 flex flex-col gap-2 text-sm text-text-secondary">
                  {card.values.map((v) => (
                    <li
                      key={v}
                      className="flex items-center gap-2 rounded-md bg-bg-surface px-3 py-1.5"
                    >
                      <span className="h-2 w-2 rounded-full bg-accent-blue" />
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <div className="grid gap-4 md:grid-cols-4">
            {trends.map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-dh-border bg-white p-4"
              >
                <p className="text-xs text-text-secondary">{t.label}</p>
                <p className="font-heading text-2xl font-semibold text-text-primary">{t.value}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-accent-green">
                  <TrendingUp className="h-3 w-3" />
                  {t.delta}
                </p>
              </div>
            ))}
          </div>

          <section className="mt-6 rounded-xl border border-dh-border bg-white p-5">
            <h3 className="font-heading text-base font-semibold text-text-primary">
              월별 사용량 추세 (mock)
            </h3>
            <div className="mt-4 grid grid-cols-12 items-end gap-2 px-1">
              {[42, 55, 60, 68, 72, 80, 84, 88, 92, 96, 102, 110].map((v, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-accent-blue/80"
                    style={{ height: `${v * 1.4}px` }}
                  />
                  <span className="text-[10px] text-text-muted">M{i + 1}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">
              실제 차트는 Recharts 연동 시 교체됩니다.
            </p>
          </section>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <section className="rounded-xl border border-dh-border bg-white p-5">
            <h3 className="font-heading text-base font-semibold text-text-primary">
              Active Members
            </h3>
            <ul className="mt-3 divide-y divide-dh-border">
              {activeMembers.map((m) => (
                <li key={m.email} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {m.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{m.name}</p>
                    <p className="text-xs text-text-muted">{m.email}</p>
                  </div>
                  <span className="rounded-full bg-bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    {m.role}
                  </span>
                  <Link
                    href="/governance/audit"
                    className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80"
                  >
                    Audit
                    <Activity className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-dh-border bg-white p-5">
              <h3 className="font-heading text-base font-semibold text-text-primary">
                메타데이터 품질 점수
              </h3>
              <ul className="mt-4 flex flex-col gap-4">
                {quality.map((q) => (
                  <li key={q.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-primary">{q.label}</span>
                      <span className="text-xs text-text-secondary">{q.score}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg-surface">
                      <div
                        className={`h-full rounded-full ${q.color}`}
                        style={{ width: `${q.score}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-dh-border bg-white p-5">
              <h3 className="font-heading text-base font-semibold text-text-primary">
                점검 결과
              </h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li className="flex items-center gap-2 rounded-md bg-bg-surface px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-accent-green" />
                  스키마 검증 통과 — 380 / 428
                </li>
                <li className="flex items-center gap-2 rounded-md bg-bg-surface px-3 py-2">
                  <ShieldAlert className="h-4 w-4 text-accent-orange" />
                  민감도 미지정 자산 — 4건
                  <Link href="/governance/compliance" className="ml-auto text-xs font-medium text-brand hover:text-brand/80">
                    조치
                  </Link>
                </li>
                <li className="flex items-center gap-2 rounded-md bg-bg-surface px-3 py-2">
                  <ShieldAlert className="h-4 w-4 text-brand" />
                  Lineage 누락 — 32건
                  <Link href="/datasets?filter=lineage-missing" className="ml-auto text-xs font-medium text-brand hover:text-brand/80">
                    조치
                  </Link>
                </li>
              </ul>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
