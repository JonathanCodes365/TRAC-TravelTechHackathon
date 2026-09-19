import { useEffect, useState, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { ApiError, api, errorText } from "@/lib/api";
import type { Report, ReportChanges, SystemHealth } from "@/lib/reports";

export const REFRESH_MS = 10_000;
// While the AI is still checking a report, look again sooner so its answer shows up quickly.
const AI_PENDING_REFRESH_MS = 2_000;

const REPORTS_KEY = "reports";
const reportKey = (id: number) => ["report", id] as const;

// All reports, refreshed every 10 seconds so the dashboard stays live.
export function useReports(onSuccess?: () => void) {
  return useSWR(REPORTS_KEY, api.listReports, {
    refreshInterval: (latest) =>
      latest?.some((r) => r.ai_state === "pending") ? AI_PENDING_REFRESH_MS : REFRESH_MS,
    keepPreviousData: true,
    onSuccess,
  });
}

// One report, refreshed every 10 seconds so its status page updates by itself.
// Pass null to skip loading.
export function useReport(id: number | null) {
  return useSWR(id === null ? null : reportKey(id), () => api.getReport(id as number), {
    refreshInterval: (latest) => (latest?.ai_state === "pending" ? AI_PENDING_REFRESH_MS : REFRESH_MS),
    shouldRetryOnError: (err) => !(err instanceof ApiError && err.status === 404),
  });
}

// Whether the backend, the database and the AI service are all working.
export function useSystemHealth(): { state: "checking" | "online" | "offline"; health?: SystemHealth } {
  const { data, error } = useSWR("health", api.health, { refreshInterval: 15_000 });
  if (error) return { state: "offline" };
  return data ? { state: "online", health: data } : { state: "checking" };
}

// What the AI reads in a message while someone types it: waits until they pause,
// and remembers answers so the same text isn't analyzed twice.
export function useAiSuggestion(text: string) {
  const [settled, setSettled] = useState(text.trim());
  useEffect(() => {
    const timer = setTimeout(() => setSettled(text.trim()), 700);
    return () => clearTimeout(timer);
  }, [text]);

  const key = settled.length >= 12 ? (["analyze", settled] as const) : null;
  const result = useSWR(key, ([, message]) => api.analyzeText(message), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
  return { ...result, active: key !== null, typing: text.trim() !== settled };
}

// Changes to reports: the screen updates right away, then the server confirms.
export function useReportActions() {
  const { mutate } = useSWRConfig();

  function replaceInCache(id: number, next: Report | null) {
    mutate(
      REPORTS_KEY,
      (list?: Report[]) =>
        list?.flatMap((r) => (r.id !== id ? [r] : next ? [next] : [])),
      { revalidate: false },
    );
    if (next) mutate(reportKey(id), next, { revalidate: false });
  }

  async function updateReport(report: Report, changes: ReportChanges, successMessage: string) {
    replaceInCache(report.id, { ...report, ...changes });
    try {
      const saved = await api.updateReport(report.id, changes);
      replaceInCache(report.id, saved);
      toast.success(successMessage);
      return true;
    } catch (err) {
      toast.error(errorText(err));
      return false;
    } finally {
      mutate(REPORTS_KEY);
      mutate(reportKey(report.id));
    }
  }

  async function deleteReport(report: Report) {
    try {
      await api.deleteReport(report.id);
      replaceInCache(report.id, null);
      toast.success(`Report #${report.id} deleted`);
      return true;
    } catch (err) {
      toast.error(errorText(err));
      return false;
    } finally {
      mutate(REPORTS_KEY);
    }
  }

  // The AI thinks the report repeats an earlier one: "merge" closes it as a copy.
  function confirmDuplicate(report: Report) {
    return updateReport(
      report,
      { duplicate_state: "confirmed", status: "resolved" },
      `Report #${report.id} merged into #${report.duplicate_of}`,
    );
  }

  function dismissDuplicate(report: Report) {
    return updateReport(report, { duplicate_state: "dismissed" }, `Report #${report.id} kept as a separate report`);
  }

  async function reanalyze(report: Report) {
    try {
      replaceInCache(report.id, await api.reanalyze(report.id));
      toast.success(`Checking report #${report.id} with the AI again`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      mutate(REPORTS_KEY);
    }
  }

  return { updateReport, deleteReport, confirmDuplicate, dismissDuplicate, reanalyze };
}

// The current time, updated every 30 seconds, for "5 min ago" labels.
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function usePrefersDark() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DARK_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}
