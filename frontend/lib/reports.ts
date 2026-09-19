// Report data shared across the app. The types mirror backend/schemas.py.

export const REPORT_TYPES = ["rescue", "injured", "missing", "incident", "safe"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_STATUSES = ["open", "in_progress", "resolved"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type Report = {
  id: number;
  type: ReportType;
  message: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ReportStatus;
  created_at: string | null;
};

export type NewReport = Pick<Report, "type" | "message" | "location" | "latitude" | "longitude">;

// Body for PATCH /reports/{id}: only the fields that change.
export type ReportChanges = Partial<NewReport & { status: ReportStatus }>;

export type Coords = { latitude: number; longitude: number };
export type PinnedReport = Report & Coords;

export const TYPE_INFO: Record<ReportType, { label: string; hint: string; color: string }> = {
  rescue: { label: "Rescue", hint: "Trapped or in danger", color: "#ef4444" },
  injured: { label: "Injured", hint: "Hurt and needs medical help", color: "#f97316" },
  missing: { label: "Missing", hint: "Someone can't be found", color: "#8b5cf6" },
  incident: { label: "Incident", hint: "Landslide, flood, blocked road", color: "#eab308" },
  safe: { label: "Safe", hint: "Let people know you're OK", color: "#22c55e" },
};

export const STATUS_INFO: Record<ReportStatus, { label: string; hint: string; color: string }> = {
  open: { label: "Open", hint: "Waiting for a response", color: "#f59e0b" },
  in_progress: { label: "In progress", hint: "A team is responding", color: "#3b82f6" },
  resolved: { label: "Resolved", hint: "Handled by the team", color: "#10b981" },
};

// Lower is more urgent. Used for "Most urgent" sorting and map highlights.
const TYPE_PRIORITY: Record<ReportType, number> = { rescue: 0, injured: 1, missing: 2, incident: 3, safe: 4 };
const STATUS_PRIORITY: Record<ReportStatus, number> = { open: 0, in_progress: 1, resolved: 2 };

export function hasCoords(report: Report): report is PinnedReport {
  return typeof report.latitude === "number" && typeof report.longitude === "number";
}

// Open rescue and injury reports get a pulsing pin and count as urgent.
export function isUrgent(report: Report) {
  return report.status === "open" && TYPE_PRIORITY[report.type] <= 1;
}

export type SortKey = "newest" | "oldest" | "urgent";

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  urgent: "Most urgent",
};

// Ids come from the database in order, so a higher id is a newer report.
export function sortReports(reports: Report[], key: SortKey): Report[] {
  const sorted = [...reports];
  if (key === "oldest") return sorted.sort((a, b) => a.id - b.id);
  if (key === "urgent") {
    return sorted.sort(
      (a, b) =>
        STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
        TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type] ||
        b.id - a.id,
    );
  }
  return sorted.sort((a, b) => b.id - a.id);
}
