"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GitMerge, LoaderCircle, RotateCw, Sparkles, X } from "lucide-react";
import { StatusBadge, TypeBadge } from "@/components/ReportBadges";
import { useReport, useReportActions } from "@/lib/hooks";
import { TYPE_INFO, duplicateLabel, type Report } from "@/lib/reports";

// What the AI found in a report, and its duplicate suggestion with Merge / Not a duplicate.
export default function AiInsights({ report }: { report: Report }) {
  const { reanalyze, updateReport } = useReportActions();
  const aiType = report.ai_suggested_type;
  const typeDiffers = aiType !== null && aiType !== report.type;

  return (
    <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-violet-500" aria-hidden />
          AI insights
        </h3>
        {report.ai_state === "done" && report.ai_source && (
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted">
            {report.ai_source === "model" ? "Language model" : "Keyword rules"}
          </span>
        )}
      </div>

      {report.ai_state === "pending" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Checking this report…
        </p>
      )}

      {(report.ai_state === "failed" || report.ai_state === null) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-ink-muted">
            {report.ai_state === "failed"
              ? "The AI service couldn’t check this report."
              : "This report hasn’t been checked by the AI."}
          </span>
          <button
            type="button"
            onClick={() => reanalyze(report)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-muted"
          >
            <RotateCw className="size-3.5" aria-hidden />
            {report.ai_state === "failed" ? "Try again" : "Check now"}
          </button>
        </div>
      )}

      {report.ai_state === "done" && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Fact label="People mentioned">
            {report.people_count ?? <span className="text-ink-subtle">Not stated</span>}
          </Fact>
          <Fact label="Name mentioned">{report.person_name ?? <span className="text-ink-subtle">None</span>}</Fact>
          <div className="col-span-2">
            <Fact label="Reads as">
              {aiType ? (
                <span className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={aiType} />
                  {typeDiffers ? (
                    <>
                      <span className="text-xs text-ink-muted">Reported as {TYPE_INFO[report.type].label}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateReport(report, { type: aiType }, `Report #${report.id} changed to ${TYPE_INFO[aiType].label}`)
                        }
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold hover:bg-surface-muted"
                      >
                        Use this type
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Matches the report type</span>
                  )}
                </span>
              ) : (
                <span className="text-ink-subtle">No clear type in the message</span>
              )}
            </Fact>
          </div>
        </dl>
      )}

      <DuplicateReview report={report} />
    </section>
  );
}

function DuplicateReview({ report }: { report: Report }) {
  const { confirmDuplicate, dismissDuplicate } = useReportActions();
  const { data: original, error } = useReport(report.duplicate_of);
  const originalId = report.duplicate_of;

  if (originalId === null || report.duplicate_state === null) return null;

  if (report.duplicate_state === "confirmed") {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
        <GitMerge className="size-4 text-amber-500" aria-hidden />
        Merged into{" "}
        <Link href={`/reports/${originalId}`} className="font-semibold underline underline-offset-2">
          report #{originalId}
        </Link>
      </p>
    );
  }

  if (report.duplicate_state === "dismissed") {
    return (
      <p className="mt-4 text-xs text-ink-muted">
        A coordinator marked this as separate from{" "}
        <Link href={`/reports/${originalId}`} className="underline underline-offset-2">
          report #{originalId}
        </Link>
        .
      </p>
    );
  }

  const percent = Math.round((report.duplicate_score ?? 0) * 100);

  return (
    <div className="mt-4 rounded-xl border border-amber-500/35 bg-surface p-3">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          <GitMerge className="size-4 text-amber-500" aria-hidden />
          {duplicateLabel(report.duplicate_score)} of #{originalId}
        </span>
        <span className="text-ink-muted tabular-nums">{percent}% match</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
      </div>

      {original ? (
        <Link
          href={`/reports/${original.id}`}
          className="mt-3 block rounded-lg border border-line p-2.5 transition-colors hover:bg-surface-muted"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={original.type} />
            <StatusBadge status={original.status} />
          </span>
          <span className="mt-1.5 line-clamp-2 block text-sm">{original.message}</span>
          {original.location && <span className="block text-xs text-ink-muted">{original.location}</span>}
        </Link>
      ) : error ? (
        <p className="mt-3 text-xs text-ink-muted">Report #{originalId} couldn’t be loaded.</p>
      ) : (
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-surface-muted" />
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => confirmDuplicate(report)}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-white hover:bg-amber-600"
        >
          <GitMerge className="size-4" aria-hidden />
          Merge into #{originalId}
        </button>
        <button
          type="button"
          onClick={() => dismissDuplicate(report)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-surface-muted"
        >
          <X className="size-4" aria-hidden />
          Not a duplicate
        </button>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}
