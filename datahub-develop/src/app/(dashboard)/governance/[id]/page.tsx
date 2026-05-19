import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MessageSquare,
  GitPullRequest,
  Clock,
  Calendar,
  User,
  Tag,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getGovernanceRequest,
  statusLabel,
  statusBadgeClass,
  priorityBadgeClass,
} from "@/lib/storyboard/governance-data";

interface Props {
  params: { id: string };
}

const comments = [
  {
    author: "Jieun Kim",
    initials: "JK",
    role: "Reviewer",
    time: "3 hours ago",
    body: "augmented sample 수가 두 배가 됐는데 validation split 비율이 업데이트되지 않았습니다. 평가 데이터 누수 방지를 위해 train/val 비율을 80/20으로 유지해야 합니다.",
    reactions: { "👍": 3, "❤️": 1 },
  },
  {
    author: "Minjun Park",
    initials: "MP",
    role: "Reviewer",
    time: "2 hours ago",
    body: "동의합니다. validation split 적용 후 재제출 부탁드립니다. 모델 카드의 Limitations 섹션도 함께 업데이트가 필요해 보입니다.",
    reactions: { "👍": 2 },
  },
];

const timeline = [
  { time: "2026-04-28 09:14", actor: "Sanghyun Seo", action: "Created request" },
  { time: "2026-04-28 10:22", actor: "Jieun Kim", action: "Assigned as reviewer" },
  { time: "2026-04-28 11:05", actor: "System", action: "Auto-attached policy template — Model Release Approval" },
  { time: "2026-04-28 14:48", actor: "Jieun Kim", action: "Left a comment" },
  { time: "2026-04-28 15:12", actor: "Minjun Park", action: "Left a comment" },
];

export default function GovernanceDetailPage({ params }: Props) {
  const request = getGovernanceRequest(params.id);

  return (
    <div>
      <Link
        href="/governance"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Governance Requests
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-text-muted">{request.id}</span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass[request.status]}`}
                >
                  {statusLabel[request.status]}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${priorityBadgeClass[request.priority]}`}
                >
                  {request.priority}
                </span>
              </div>
              <h1 className="mt-2 font-heading text-2xl font-semibold text-text-primary">
                {request.title}
              </h1>
              <p className="mt-1 text-xs text-text-secondary">
                Opened by{" "}
                <span className="text-text-primary font-medium">
                  {request.requester.name}
                </span>{" "}
                · {request.createdAt} · Updated {request.updatedAt}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Reject
              </Button>
              <Button size="sm" className="bg-accent-green text-white hover:bg-accent-green/90">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Approve
              </Button>
            </div>
          </div>

          {/* Description card */}
          <section className="mt-6 rounded-xl border border-dh-border bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-text-secondary">
              <GitPullRequest className="h-3.5 w-3.5" />
              Description
            </h2>
            <p className="text-sm leading-relaxed text-text-primary">
              {request.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <Link
                href={`/${request.relatedRepo}`}
                className="inline-flex items-center gap-1 rounded-md border border-dh-border bg-bg-surface px-2 py-1 text-text-secondary hover:text-brand"
              >
                <Database className="h-3 w-3" />
                {request.relatedRepo}
              </Link>
            </div>
          </section>

          {/* Comments */}
          <section className="mt-6 rounded-xl border border-dh-border bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-text-secondary">
              <MessageSquare className="h-3.5 w-3.5" />
              Comments ({comments.length})
            </h2>
            <ul className="flex flex-col gap-4">
              {comments.map((c, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 border-b border-dh-border pb-4 last:border-0 last:pb-0"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                    {c.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-text-primary">{c.author}</span>
                      <span className="text-text-muted">{c.role}</span>
                      <span className="text-text-muted">·</span>
                      <span className="text-text-muted">{c.time}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-text-primary">{c.body}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {Object.entries(c.reactions).map(([emoji, n]) => (
                        <button
                          key={emoji}
                          className="inline-flex items-center gap-1 rounded-full border border-dh-border bg-bg-surface px-2 py-0.5 text-xs text-text-secondary hover:bg-white"
                        >
                          {emoji} {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-dh-border pt-4">
              <Textarea placeholder="Leave a comment..." rows={3} />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="outline" size="sm">Markdown Preview</Button>
                <Button size="sm" className="bg-brand text-white hover:bg-brand/90">
                  Comment
                </Button>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="mt-6 rounded-xl border border-dh-border bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase text-text-secondary">
              <Clock className="h-3.5 w-3.5" />
              Activity Timeline
            </h2>
            <ol className="border-l border-dh-border pl-4">
              {timeline.map((t, i) => (
                <li key={i} className="relative pb-3 text-sm">
                  <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-brand" />
                  <span className="text-xs text-text-muted">{t.time}</span>
                  <p className="text-text-primary">
                    <span className="font-medium">{t.actor}</span> {t.action}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-dh-border bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-text-secondary">
              Request Info
            </h3>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-text-secondary">
                  <User className="h-3.5 w-3.5" />
                  Requester
                </dt>
                <dd className="text-text-primary">{request.requester.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-text-secondary">
                  <Calendar className="h-3.5 w-3.5" />
                  Date
                </dt>
                <dd className="text-text-primary">{request.createdAt}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-text-secondary">
                  <Tag className="h-3.5 w-3.5" />
                  Type
                </dt>
                <dd className="text-text-primary">{request.type}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-text-secondary">Priority</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase ${priorityBadgeClass[request.priority]}`}
                  >
                    {request.priority}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-dh-border bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-text-secondary">
              Approvers
            </h3>
            <ul className="flex flex-col gap-2">
              {request.approvers.map((a) => (
                <li key={a.name} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-surface text-[10px] font-semibold text-text-primary">
                    {a.initials}
                  </span>
                  <span className="text-sm text-text-primary">{a.name}</span>
                  <span className="ml-auto text-xs text-text-muted">대기</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-dh-border bg-white p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase text-text-secondary">
              Related Policy
            </h3>
            <Link
              href="/governance/templates"
              className="flex items-center justify-between rounded-md border border-dh-border bg-bg-surface px-3 py-2 text-sm hover:border-brand/30"
            >
              <span className="text-text-primary">Model Release Approval</span>
              <span className="text-xs text-text-muted">템플릿 →</span>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
