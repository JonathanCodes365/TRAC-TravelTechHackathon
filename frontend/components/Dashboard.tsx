"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import TypeBadge from "@/components/TypeBadge";
import {
  REPORT_TYPES,
  REPORT_TYPE_INFO,
  fetchReports,
  hasCoords,
  type Report,
  type ReportType,
} from "@/lib/reports";

const REFRESH_MS = 10_000;

// Leaflet needs `window`, so the map only renders in the browser.
const ReportMap = dynamic(() => import("@/components/ReportMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-zinc-100 text-sm text-zinc-500">Loading map…</div>
  ),
});

export default function Dashboard() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<ReportType | "all">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    fetchReports().then(
      (data) => {
        // Newest first. Ids come from the database, so a higher id is a newer report.
        setReports([...data].sort((a, b) => b.id - a.id));
        setError(null);
        setUpdatedAt(new Date());
      },
      (err) => setError(err instanceof Error ? err.message : "Couldn't load reports."),
    );
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const all = reports ?? [];
  const query = search.trim().toLowerCase();
  const visible = all.filter(
    (r) =>
      (filter === "all" || r.type === filter) &&
      (!query ||
        r.message.toLowerCase().includes(query) ||
        (r.location ?? "").toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coordinator dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {reports === null
              ? error
                ? "Reports unavailable"
                : "Loading reports…"
              : `${all.length} report${all.length === 1 ? "" : "s"}`}
            {updatedAt && ` · updated ${updatedAt.toLocaleTimeString()}`} · refreshes every{" "}
            {REFRESH_MS / 1000} seconds
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
        >
          Refresh now
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {reports === null
            ? "Couldn't load reports: "
            : "Couldn't refresh, so these may be out of date: "}
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="All" count={all.length} active={filter === "all"} onClick={() => setFilter("all")} />
        {REPORT_TYPES.map((t) => (
          <FilterChip
            key={t}
            label={REPORT_TYPE_INFO[t].label}
            color={REPORT_TYPE_INFO[t].color}
            count={all.filter((r) => r.type === t).length}
            active={filter === t}
            onClick={() => setFilter(t)}
          />
        ))}
        <label className="w-full sm:ml-auto sm:w-64">
          <span className="sr-only">Search reports</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message or location"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="isolate h-[420px] overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:h-[620px]">
          <ReportMap reports={visible} />
        </div>

        {reports === null ? (
          <EmptyPanel>{error ? "No reports to show." : "Loading reports…"}</EmptyPanel>
        ) : visible.length === 0 ? (
          <EmptyPanel>
            {all.length === 0
              ? "No reports yet. Reports sent from the Report page show up here."
              : "No reports match this filter."}
          </EmptyPanel>
        ) : (
          <ul className="space-y-3 lg:max-h-[620px] lg:overflow-y-auto lg:pr-1">
            {visible.map((r) => (
              <ReportCard key={r.id} report={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400"
      }`}
    >
      {color && <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {label}
      <span className={active ? "text-zinc-300" : "text-zinc-500"}>{count}</span>
    </button>
  );
}

function ReportCard({ report }: { report: Report }) {
  const color = REPORT_TYPE_INFO[report.type].color;

  return (
    <li
      className="rounded-xl border border-l-4 border-zinc-200 bg-white p-4 shadow-sm"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center justify-between gap-2">
        <TypeBadge type={report.type} />
        <span className="text-xs text-zinc-500">#{report.id}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-900">{report.message}</p>
      {(report.location || hasCoords(report)) && (
        <p className="mt-2 text-xs text-zinc-600">
          {report.location}
          {report.location && hasCoords(report) && " · "}
          {hasCoords(report) && `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`}
        </p>
      )}
    </li>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
