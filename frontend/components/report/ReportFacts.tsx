"use client";

import type { ReactNode } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatCoords, formatDateTime, googleMapsUrl, parseDate, timeAgo } from "@/lib/format";
import { hasCoords, type Report } from "@/lib/reports";

export default function ReportFacts({ report, now }: { report: Report; now: number }) {
  const created = parseDate(report.created_at);

  async function copyCoords(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Coordinates copied");
    } catch {
      toast.error("Couldn't copy. Select the numbers and copy them instead.");
    }
  }

  return (
    <dl className="space-y-4 text-sm">
      <Fact label="Message">
        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{report.message}</p>
      </Fact>
      <Fact label="Place">{report.location ?? <span className="text-ink-subtle">Not given</span>}</Fact>
      <Fact label="GPS">
        {hasCoords(report) ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{formatCoords(report.incident_latitude, report.incident_longitude)}</span>
            <button
              type="button"
              onClick={() => copyCoords(formatCoords(report.incident_latitude, report.incident_longitude))}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink"
            >
              <Copy className="size-3.5" aria-hidden />
              Copy
            </button>
            <a
              href={googleMapsUrl(report.incident_latitude, report.incident_longitude)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink-muted hover:text-ink"
            >
              Google Maps
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        ) : (
          <span className="text-ink-subtle">No map location</span>
        )}
      </Fact>
      <Fact label="Reported">
        {created ? (
          <>
            {formatDateTime(created)} <span className="text-ink-subtle">· {timeAgo(created, now)}</span>
          </>
        ) : (
          <span className="text-ink-subtle">Time not recorded</span>
        )}
      </Fact>
    </dl>
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
