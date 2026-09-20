"use client";

import Link from "next/link";
import {
  Activity,
  CloudLightning,
  ExternalLink,
  Flame,
  Mountain,
  Route,
  ShieldCheck,
  Snowflake,
  TriangleAlert,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { SEVERITY_INFO, hazardLabel, severityRank, type DangerZone } from "@/lib/zones";

const HAZARD_ICONS: Record<string, LucideIcon> = {
  flood: Waves,
  landslide: Mountain,
  earthquake: Activity,
  avalanche: Snowflake,
  fire: Flame,
  storm: CloudLightning,
};

export function HazardIcon({ hazard, className }: { hazard: string; className?: string }) {
  const Icon = HAZARD_ICONS[hazard] ?? TriangleAlert;
  return <Icon className={className} aria-hidden />;
}

type Props = {
  zones: DangerZone[];
  focusedId: number | null;
  onFocus: (id: number) => void;
};

// The disaster areas the system is tracking right now, above the dashboard.
export default function ZoneAlerts({ zones, focusedId, onFocus }: Props) {
  if (zones.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted shadow-sm">
        <ShieldCheck className="size-4 text-emerald-500" aria-hidden />
        No disaster areas right now. Reports of trouble in the same place will raise one automatically.
      </div>
    );
  }

  const sorted = [...zones].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || b.report_count - a.report_count,
  );
  const worst = SEVERITY_INFO[sorted[0].severity];

  return (
    <div className="rounded-2xl border bg-surface p-3 shadow-sm" style={{ borderColor: `${worst.color}66` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4" style={{ color: worst.color }} aria-hidden />
          {sorted.length} disaster {sorted.length === 1 ? "area" : "areas"} active
          <span className="font-normal text-ink-muted">· from live reports and the USGS earthquake feed</span>
        </p>
        <Link
          href="/safe-route"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-surface-muted"
        >
          <Route className="size-3.5" aria-hidden />
          Plan a safe route
        </Link>
      </div>

      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {sorted.map((zone) => {
          const severity = SEVERITY_INFO[zone.severity] ?? SEVERITY_INFO.watch;
          const focused = zone.id === focusedId;
          return (
            <li key={zone.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onFocus(zone.id)}
                aria-pressed={focused}
                className={`flex w-64 items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors hover:bg-surface-muted ${
                  focused ? "border-ink" : "border-line"
                }`}
              >
                <span
                  className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${severity.color}1f` }}
                >
                  <HazardIcon hazard={zone.hazard} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{zone.title}</span>
                  <span className="block text-xs" style={{ color: severity.color }}>
                    {severity.label}
                    <span className="text-ink-muted">
                      {" · "}
                      {hazardLabel(zone.hazard)} · {zone.radius_km} km
                      {zone.report_count ? ` · ${zone.report_count} reports` : ""}
                      {zone.people_count ? ` · ${zone.people_count} people` : ""}
                    </span>
                  </span>
                  {zone.source === "usgs" && zone.external_url && (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-subtle">
                      USGS <ExternalLink className="size-3" aria-hidden />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
