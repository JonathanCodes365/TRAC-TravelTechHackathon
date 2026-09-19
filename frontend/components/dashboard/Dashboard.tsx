"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Plus, RefreshCw } from "lucide-react";
import ReportList from "@/components/dashboard/ReportList";
import ReportPanel from "@/components/dashboard/ReportPanel";
import StatCards from "@/components/dashboard/StatCards";
import Toolbar, { NO_FILTERS, type Filters } from "@/components/dashboard/Toolbar";
import { errorText } from "@/lib/api";
import { REFRESH_MS, useNow, useReports } from "@/lib/hooks";
import { sortReports, type Report } from "@/lib/reports";

// Leaflet needs `window`, so the map only renders in the browser.
const ReportsMap = dynamic(() => import("@/components/map/ReportsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-muted" />,
});

export default function Dashboard() {
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { data: reports, error, isValidating, mutate } = useReports(() => setUpdatedAt(new Date()));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const now = useNow();
  const sideRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => reports ?? [], [reports]);
  const visible = useMemo(() => applyFilters(all, filters), [all, filters]);
  // If the selected report is deleted, this becomes null and the panel closes.
  const selected = all.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId === null) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedId]);

  function select(id: number) {
    setSelectedId(id);
    // On narrow screens the panel sits below the map, so scroll it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      sideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Coordinator dashboard</h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-muted">
            <span className={`size-2 rounded-full ${error ? "bg-red-500" : "bg-emerald-500"}`} aria-hidden />
            {error
              ? "Connection problem, retrying…"
              : updatedAt
                ? `Live · updated ${updatedAt.toLocaleTimeString()}`
                : "Connecting…"}
            <span className="hidden sm:inline">· refreshes every {REFRESH_MS / 1000} seconds</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold hover:bg-surface-muted"
          >
            <Plus className="size-4" aria-hidden />
            New report
          </Link>
          <button
            type="button"
            onClick={() => mutate()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-3.5 text-sm font-semibold text-surface hover:opacity-90"
          >
            <RefreshCw className={`size-4 ${isValidating ? "animate-spin" : ""}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {reports ? "Couldn’t refresh, so these reports may be out of date: " : "Couldn’t load reports: "}
          {errorText(error)}
        </p>
      )}

      <StatCards reports={all} now={now} loading={!reports && !error} />

      <Toolbar reports={all} filters={filters} onChange={setFilters} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="h-[420px] overflow-hidden rounded-3xl border border-line bg-surface shadow-sm lg:h-[680px]">
          <ReportsMap reports={visible} selectedId={selectedId} onSelect={select} />
        </div>

        <div ref={sideRef} className="scroll-mt-24 lg:h-[680px]">
          {selected ? (
            <ReportPanel report={selected} now={now} onClose={() => setSelectedId(null)} />
          ) : !reports ? (
            <div className="h-full min-h-60 animate-pulse rounded-3xl border border-line bg-surface" />
          ) : all.length === 0 ? (
            <EmptyState />
          ) : (
            <ReportList reports={visible} total={all.length} selectedId={selectedId} onSelect={select} now={now} />
          )}
        </div>
      </div>
    </div>
  );
}

function applyFilters(reports: Report[], { status, types, search, sort }: Filters) {
  const query = search.trim().toLowerCase().replace(/^#/, "");
  const matches = reports.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (types.length === 0 || types.includes(r.type)) &&
      (!query ||
        String(r.id) === query ||
        r.message.toLowerCase().includes(query) ||
        (r.location ?? "").toLowerCase().includes(query)),
  );
  return sortReports(matches, sort);
}

function EmptyState() {
  return (
    <div className="grid h-full min-h-60 place-items-center rounded-3xl border border-dashed border-line-strong bg-surface p-8 text-center">
      <div>
        <Inbox className="mx-auto size-10 text-ink-subtle" aria-hidden />
        <h2 className="mt-4 font-semibold">No reports yet</h2>
        <p className="mt-1 text-sm text-ink-muted">Reports sent from the report page show up here right away.</p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90"
        >
          <Plus className="size-4" aria-hidden />
          Send a report
        </Link>
      </div>
    </div>
  );
}
