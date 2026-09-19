"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { StatusBadge, TypeIcon } from "@/components/ReportBadges";
import AiInsights from "@/components/report/AiInsights";
import ReportActions from "@/components/report/ReportActions";
import ReportFacts from "@/components/report/ReportFacts";
import { TYPE_INFO, type Report } from "@/lib/reports";

type Props = { report: Report; now: number; onClose: () => void };

// The selected report, shown next to the map in place of the list.
export default function ReportPanel({ report, now, onClose }: Props) {
  const info = TYPE_INFO[report.type];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All reports
        </button>
        <Link
          href={`/reports/${report.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          Open page
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="space-y-5 p-5 lg:flex-1 lg:overflow-y-auto">
        <div className="flex items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-xl"
            style={{ backgroundColor: `${info.color}1f` }}
          >
            <TypeIcon type={report.type} className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">
              {info.label} · #{report.id}
            </h2>
            <div className="mt-1">
              <StatusBadge status={report.status} />
            </div>
          </div>
        </div>

        <ReportFacts report={report} now={now} />

        <AiInsights report={report} />

        <div className="border-t border-line pt-5">
          <ReportActions key={report.id} report={report} />
        </div>
      </div>
    </div>
  );
}
