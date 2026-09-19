// Report types and API calls shared by the report form and the dashboard.
// They mirror the FastAPI schemas in the repo root (Reporttype, Report, ReportResponse).

export const REPORT_TYPES = ["rescue", "injured", "missing", "incident", "safe"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_INFO: Record<ReportType, { label: string; hint: string; color: string }> = {
  rescue: { label: "Rescue", hint: "Trapped or in danger", color: "#dc2626" },
  injured: { label: "Injured", hint: "Hurt and needs medical help", color: "#ea580c" },
  missing: { label: "Missing", hint: "Someone can't be found", color: "#7c3aed" },
  incident: { label: "Incident", hint: "Landslide, flood, blocked road", color: "#ca8a04" },
  safe: { label: "Safe", hint: "Let people know you're OK", color: "#16a34a" },
};

export type NewReport = {
  type: ReportType;
  message: string;
  location: string | null;
  // The backend ignores these until it has latitude/longitude columns.
  // The dashboard map only shows reports that have them.
  latitude: number | null;
  longitude: number | null;
};

export type Report = {
  id: number;
  type: ReportType;
  message: string;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type PinnedReport = Report & { latitude: number; longitude: number };

export function hasCoords(report: Report): report is PinnedReport {
  return typeof report.latitude === "number" && typeof report.longitude === "number";
}

// Requests go to /api/..., which next.config.ts forwards to the FastAPI backend.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { cache: "no-store", ...init });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

// FastAPI errors look like {"detail": "Report not found"} or, for invalid input (422),
// {"detail": [{"loc": ["body", "message"], "msg": "Field required"}]}.
async function errorMessage(res: Response): Promise<string> {
  try {
    const { detail } = await res.json();
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: (string | number)[]; msg: string }) => `${d.loc?.at(-1) ?? "request"}: ${d.msg}`)
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

export function createReport(report: NewReport) {
  return request<unknown>("/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
}

export function fetchReports() {
  return request<Report[]>("/reports");
}
