"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import { ArrowLeft, CircleCheck, Hourglass, Inbox, SearchX } from "lucide-react";
import { StatusBadge, TypeIcon } from "@/components/ReportBadges";
import ReportActions from "@/components/report/ReportActions";
import ReportFacts from "@/components/report/ReportFacts";
import { ApiError, errorText } from "@/lib/api";
import { parseDate, timeAgo } from "@/lib/format";
import { useNow, useReport } from "@/lib/hooks";
import { TYPE_INFO, type ReportStatus } from "@/lib/reports";

const ReportsMap = dynamic(() => import("@/components/map/ReportsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-muted" />,
});

export default function ReportDetail({ id }: { id: number }) {
  const { data: report, error } = useReport(id);
  const router = useRouter();
  const now = useNow();

  if (!report) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Notice title="Report not found" text={`There’s no report #${id}. It may have been deleted.`} />
      );
    }
    if (error) return <Notice title="Couldn’t load this report" text={errorText(error)} />;
    return <div className="mx-auto h-96 max-w-5xl animate-pulse rounded-3xl bg-surface-muted" />;
  }

  const info = TYPE_INFO[report.type];
  const created = parseDate(report.created_at);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        Dashboard
      </Link>

      <header className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-2xl"
          style={{ backgroundColor: `${info.color}1f` }}
        >
          <TypeIcon type={report.type} className="size-7" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{info.label} report</h1>
            <StatusBadge status={report.status} />
          </div>
          <p className="mt-1 truncate text-sm text-ink-muted">
            #{report.id}
            {created && ` · reported ${timeAgo(created, now)}`}
            {report.location && ` · ${report.location}`}
          </p>
        </div>
      </header>

      <StatusTracker status={report.status} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 font-semibold">Details</h2>
          <ReportFacts report={report} now={now} />
        </section>
        <section className="h-72 overflow-hidden rounded-3xl border border-line bg-surface shadow-sm lg:h-auto lg:min-h-80">
          <ReportsMap reports={[report]} selectedId={report.id} showLegend={false} />
        </section>
      </div>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold">Coordinator tools</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Update the status as the response moves along. Anyone following this page sees the change.
        </p>
        <ReportActions report={report} onDeleted={() => router.push("/dashboard")} />
      </section>
    </div>
  );
}

const STEPS = [
  { label: "Received", hint: "The team has the report", icon: Inbox },
  { label: "Team responding", hint: "Help is being organized", icon: Hourglass },
  { label: "Resolved", hint: "The situation is handled", icon: CircleCheck },
];

const REACHED_STEP: Record<ReportStatus, number> = { open: 0, in_progress: 1, resolved: 2 };

function StatusTracker({ status }: { status: ReportStatus }) {
  const reached = REACHED_STEP[status];

  return (
    <ol className="flex items-start rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-6">
      {STEPS.map(({ label, hint, icon: Icon }, index) => {
        const done = index <= reached;
        return (
          <Fragment key={label}>
            {index > 0 && (
              <li
                aria-hidden
                className={`mt-5 h-0.5 flex-1 rounded-full ${done ? "bg-emerald-500" : "bg-line"}`}
              />
            )}
            <li className="flex w-24 shrink-0 flex-col items-center text-center sm:w-36">
              <span
                className={`grid size-10 place-items-center rounded-full border-2 transition-colors ${
                  done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line text-ink-subtle"
                } ${index === reached && status !== "resolved" ? "ring-4 ring-emerald-500/20" : ""}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className={`mt-2 text-sm font-semibold ${done ? "text-ink" : "text-ink-subtle"}`}>{label}</span>
              <span className="hidden text-xs text-ink-muted sm:block">{hint}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-sm">
      <SearchX className="mx-auto size-10 text-ink-subtle" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">{text}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90"
      >
        Go to the dashboard
      </Link>
    </div>
  );
}
