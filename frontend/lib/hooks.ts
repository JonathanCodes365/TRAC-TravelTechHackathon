import { useEffect, useState, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { ApiError, api, errorText } from "@/lib/api";
import type { Report, ReportChanges } from "@/lib/reports";

export const REFRESH_MS = 10_000;

const REPORTS_KEY = "reports";
const reportKey = (id: number) => ["report", id] as const;

// All reports, refreshed every 10 seconds so the dashboard stays live.
export function useReports(onSuccess?: () => void) {
  return useSWR(REPORTS_KEY, api.listReports, {
    refreshInterval: REFRESH_MS,
    keepPreviousData: true,
    onSuccess,
  });
}

// One report, refreshed every 10 seconds so its status page updates by itself.
export function useReport(id: number) {
  return useSWR(reportKey(id), () => api.getReport(id), {
    refreshInterval: REFRESH_MS,
    shouldRetryOnError: (err) => !(err instanceof ApiError && err.status === 404),
  });
}

export function useApiStatus(): "checking" | "online" | "offline" {
  const { data, error } = useSWR("health", api.health, { refreshInterval: 15_000 });
  if (error) return "offline";
  return data ? "online" : "checking";
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

  return { updateReport, deleteReport };
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
