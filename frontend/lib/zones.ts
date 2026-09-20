// Disaster areas and safe routes. These match backend/zones.py and backend/schemas.py.

export type Severity = "watch" | "warning" | "critical";

export type DangerZone = {
  id: number;
  source: "reports" | "usgs";
  hazard: string;
  severity: Severity;
  title: string;
  summary: string | null;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  report_count: number;
  people_count: number | null;
  confidence: number | null;
  magnitude: number | null;
  external_url: string | null;
  event_time: string | null;
  first_seen: string | null;
  updated_at: string | null;
  active: boolean;
};

export type RouteOption = {
  label: string;
  distance_km: number;
  duration_min: number;
  geometry: [number, number][];
  zones: number[];
  zone_km: number;
  risk: "clear" | "passes_zone";
  recommended: boolean;
};

export type SafeRoute = {
  routes: RouteOption[];
  zones: DangerZone[];
  advice: string;
  start_zones: number[];
  end_zones: number[];
};

export const SEVERITY_INFO: Record<Severity, { label: string; color: string; note: string }> = {
  watch: { label: "Watch", color: "#f59e0b", note: "Early signs of trouble" },
  warning: { label: "Warning", color: "#f97316", note: "Serious, avoid the area" },
  critical: { label: "Critical", color: "#dc2626", note: "Lives at risk, stay away" },
};

export const HAZARD_LABEL: Record<string, string> = {
  flood: "Flood",
  landslide: "Landslide",
  earthquake: "Earthquake",
  avalanche: "Avalanche",
  fire: "Fire",
  storm: "Storm",
  unknown: "Incidents",
};

export function hazardLabel(hazard: string) {
  return HAZARD_LABEL[hazard] ?? hazard.charAt(0).toUpperCase() + hazard.slice(1);
}

export function severityRank(severity: Severity) {
  return { watch: 1, warning: 2, critical: 3 }[severity] ?? 0;
}

export function formatDuration(minutes: number) {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  return `${Math.floor(whole / 60)} h ${String(whole % 60).padStart(2, "0")} min`;
}
