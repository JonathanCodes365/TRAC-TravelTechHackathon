import type { Place } from "@/lib/places";
import type { AiSuggestion, Coords, NewReport, Report, ReportChanges, SystemHealth } from "@/lib/reports";
import type { DangerZone, SafeRoute } from "@/lib/zones";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Requests go to /api/..., which next.config.ts forwards to the FastAPI backend.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { cache: "no-store", ...init });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status);
  return res.json();
}

function send<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown, signal?: AbortSignal) {
  return request<T>(path, {
    method,
    signal,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
}

// FastAPI errors look like {"detail": "Report not found"} or, for invalid input (422),
// {"detail": [{"loc": ["body", "message"], "msg": "String should have at least 1 character"}]}.
async function errorMessage(res: Response): Promise<string> {
  try {
    const { detail } = await res.json();
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: (string | number)[]; msg: string }) => {
          const field = d.loc?.at(-1);
          const msg = d.msg.replace(/^Value error, /, "");
          return field && field !== "body" ? `${field}: ${msg}` : msg;
        })
        .join("; ");
    }
  } catch {
    // Not JSON. A 500 from /api usually means the backend isn't running.
  }
  if (res.status >= 500) {
    return `The server isn't responding (error ${res.status}). Is the backend running?`;
  }
  return `Request failed (error ${res.status}).`;
}

export function errorText(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong. Try again.";
}

export const api = {
  health: () => request<SystemHealth>("/health"),
  listReports: () => request<Report[]>("/reports"),
  getReport: (id: number) => request<Report>(`/reports/${id}`),
  createReport: (report: NewReport) => send<Report>("/reports", "POST", report),
  updateReport: (id: number, changes: ReportChanges) => send<Report>(`/reports/${id}`, "PATCH", changes),
  deleteReport: (id: number) => send<{ message: string }>(`/reports/${id}`, "DELETE"),
  // Ask the AI what a message is about, before it's sent.
  analyzeText: (text: string, signal?: AbortSignal) =>
    send<AiSuggestion>("/reports/analyze", "POST", { report_text: text }, signal),
  // Run the AI check on a saved report again.
  reanalyze: (id: number) => send<Report>(`/reports/${id}/analyze`, "POST"),
  // Disaster areas the backend is tracking right now.
  listZones: () => request<DangerZone[]>("/zones"),
  // Ways to travel from one place to another, marked with the danger areas they cross.
  safeRoute: (start: Coords, end: Coords) => send<SafeRoute>("/routes/safe", "POST", { start, end }),
  // Find a place by name, for the route planner's From and To boxes. Capitals don't matter.
  searchPlaces: (query: string, signal?: AbortSignal) =>
    request<Place[]>(`/places?q=${encodeURIComponent(query)}`, { signal }),
};
