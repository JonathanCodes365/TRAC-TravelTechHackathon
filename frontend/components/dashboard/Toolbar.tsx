"use client";

import type { Dispatch, SetStateAction } from "react";
import { ArrowUpDown, GitMerge, Search, X } from "lucide-react";
import { TypeIcon } from "@/components/ReportBadges";
import {
  REPORT_STATUSES,
  REPORT_TYPES,
  SORT_LABELS,
  STATUS_INFO,
  TYPE_INFO,
  hasDuplicateSuggestion,
  type Report,
  type ReportStatus,
  type ReportType,
  type SortKey,
} from "@/lib/reports";

export type Filters = {
  status: ReportStatus | "all";
  types: ReportType[];
  search: string;
  sort: SortKey;
  // Only reports the AI thinks repeat an earlier one, waiting for a coordinator's answer.
  duplicatesOnly: boolean;
};

export const NO_FILTERS: Filters = { status: "all", types: [], search: "", sort: "newest", duplicatesOnly: false };

type Props = { reports: Report[]; filters: Filters; onChange: Dispatch<SetStateAction<Filters>> };

export default function Toolbar({ reports, filters, onChange }: Props) {
  // Build on the latest filters (not the ones from this render), so quick clicks don't undo each other.
  const update = (changes: Partial<Filters>) => onChange((current) => ({ ...current, ...changes }));
  const filtering =
    filters.status !== "all" || filters.types.length > 0 || filters.search.trim() !== "" || filters.duplicatesOnly;
  const duplicates = reports.filter(hasDuplicateSuggestion).length;

  function toggleType(type: ReportType) {
    onChange((current) => ({
      ...current,
      types: current.types.includes(type) ? current.types.filter((t) => t !== type) : [...current.types, type],
    }));
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div
          role="group"
          aria-label="Filter by status"
          className="flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1 [scrollbar-width:none]"
        >
          {(["all", ...REPORT_STATUSES] as const).map((status) => {
            const active = filters.status === status;
            const n = status === "all" ? reports.length : reports.filter((r) => r.status === status).length;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => update({ status })}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                }`}
              >
                {status === "all" ? "All" : STATUS_INFO[status].label}
                <span className="ml-1.5 text-xs text-ink-subtle tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 gap-2 lg:justify-end">
          <label className="relative min-w-0 flex-1 lg:max-w-72">
            <span className="sr-only">Search reports</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Search message, place or #id"
              className="h-9 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-subtle focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            />
          </label>
          <label className="relative shrink-0">
            <span className="sr-only">Sort reports</span>
            <ArrowUpDown className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" />
            <select
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
              className="h-9 appearance-none rounded-xl border border-line bg-surface pr-3 pl-9 text-sm text-ink focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {REPORT_TYPES.map((type) => {
          const on = filters.types.includes(type);
          const { label, color } = TYPE_INFO[type];
          return (
            <button
              key={type}
              type="button"
              aria-pressed={on}
              onClick={() => toggleType(type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                on ? "border-transparent text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink"
              }`}
              style={on ? { backgroundColor: `${color}26`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
            >
              <TypeIcon type={type} className="size-3.5" />
              {label}
              <span className="text-xs text-ink-subtle tabular-nums">{reports.filter((r) => r.type === type).length}</span>
            </button>
          );
        })}
        {(duplicates > 0 || filters.duplicatesOnly) && (
          <button
            type="button"
            aria-pressed={filters.duplicatesOnly}
            onClick={() => onChange((current) => ({ ...current, duplicatesOnly: !current.duplicatesOnly }))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              filters.duplicatesOnly
                ? "border-amber-500 bg-amber-500/15 text-ink"
                : "border-amber-500/40 text-amber-700 hover:border-amber-500 dark:text-amber-300"
            }`}
          >
            <GitMerge className="size-3.5" aria-hidden />
            Possible duplicates
            <span className="text-xs tabular-nums opacity-75">{duplicates}</span>
          </button>
        )}
        {filtering && (
          <button
            type="button"
            onClick={() => onChange((current) => ({ ...NO_FILTERS, sort: current.sort }))}
            className="inline-flex items-center gap-1 px-1 text-sm text-ink-muted hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
