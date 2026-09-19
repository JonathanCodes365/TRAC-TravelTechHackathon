"use client";

import { MapPin } from "lucide-react";
import { StatusBadge, TypeBadge } from "@/components/ReportBadges";
import { formatCoords, parseDate, timeAgo } from "@/lib/format";
import { TYPE_INFO, hasCoords, type Report } from "@/lib/reports";

type Props = {
  reports: Report[];
  total: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  now: number;
};

export default function ReportList({ reports, total, selectedId, onSelect, now }: Props) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
        <span className="font-semibold">Reports</span>
        <span className="text-ink-muted tabular-nums">
          {reports.length === total ? total : `${reports.length} of ${total}`}
        </span>
      </div>
      {reports.length === 0 ? (
        <p className="grid flex-1 place-items-center p-8 text-center text-sm text-ink-muted">
          No reports match these filters.
        </p>
      ) : (
        <ul className="space-y-2 p-3 lg:flex-1 lg:overflow-y-auto">
          {reports.map((report) => (
            <li key={report.id}>
              <ReportCard report={report} selected={report.id === selectedId} onSelect={onSelect} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportCard({
  report,
  selected,
  onSelect,
  now,
}: {
  report: Report;
  selected: boolean;
  onSelect: (id: number) => void;
  now: number;
}) {
  const created = parseDate(report.created_at);
  const place =
    report.location ??
    (hasCoords(report) ? formatCoords(report.latitude, report.longitude) : "No location given");

  return (
    <button
      type="button"
      onClick={() => onSelect(report.id)}
      aria-current={selected || undefined}
      className={`relative w-full overflow-hidden rounded-2xl border bg-surface p-3.5 pl-4.5 text-left transition hover:border-line-strong hover:shadow-sm focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:outline-none ${
        selected ? "border-rose-500/60 ring-2 ring-rose-500/25" : "border-line"
      } ${report.status === "resolved" ? "opacity-70" : ""}`}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: TYPE_INFO[report.type].color }}
        aria-hidden
      />
      <span className="flex items-center gap-2">
        <TypeBadge type={report.type} />
        <StatusBadge status={report.status} />
        <span className="ml-auto shrink-0 text-xs text-ink-subtle tabular-nums">
          {created ? timeAgo(created, now) : ""}
        </span>
      </span>
      <span className="mt-2.5 line-clamp-2 block text-sm text-ink">{report.message}</span>
      <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{place}</span>
        {!hasCoords(report) && (
          <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            no GPS
          </span>
        )}
        <span className="ml-auto shrink-0 text-ink-subtle">#{report.id}</span>
      </span>
    </button>
  );
}
