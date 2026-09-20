"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  CircleCheck,
  Flag,
  LoaderCircle,
  LocateFixed,
  MapPin,
  RotateCw,
  Route,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { HazardIcon } from "@/components/dashboard/ZoneAlerts";
import { api, errorText } from "@/lib/api";
import { formatCoords } from "@/lib/format";
import { useZones } from "@/lib/hooks";
import type { Coords } from "@/lib/reports";
import { SEVERITY_INFO, formatDuration, hazardLabel, type DangerZone, type SafeRoute } from "@/lib/zones";

// Leaflet needs `window`, so the map only renders in the browser.
const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-muted" />,
});

export default function SafeRoutePlanner() {
  const { data: liveZones } = useZones();
  const [start, setStart] = useState<Coords | null>(null);
  const [end, setEnd] = useState<Coords | null>(null);
  const [picking, setPicking] = useState<"start" | "end">("start");
  const [result, setResult] = useState<SafeRoute | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  // The danger areas this route was planned against, so we can tell when they move on.
  const [zonesWhenChecked, setZonesWhenChecked] = useState<string | null>(null);

  const zones = result?.zones ?? liveZones ?? [];
  const zonesChanged = zonesWhenChecked !== null && liveZones !== undefined && zonesWhenChecked !== signature(liveZones);

  function pick(coords: Coords) {
    if (picking === "start") {
      setStart(coords);
      setPicking("end");
    } else {
      setEnd(coords);
      setPicking("start");
    }
  }

  function useMyLocation() {
    setError(null);
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setError("Location only works on https:// or localhost. Tap the map to set your starting point.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStart({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setPicking("end");
        setLocating(false);
      },
      () => {
        setError("Couldn’t get your location. Tap the map to set your starting point instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function findRoute() {
    if (!start || !end) return;
    setChecking(true);
    setError(null);
    try {
      const route = await api.safeRoute(start, end);
      setResult(route);
      setCheckedAt(new Date());
      setZonesWhenChecked(signature(route.zones));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setChecking(false);
    }
  }

  const recommended = result?.routes.find((route) => route.recommended) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="order-2 h-[420px] overflow-hidden rounded-3xl border border-line bg-surface shadow-sm lg:order-1 lg:h-[640px]">
        <RouteMap start={start} end={end} routes={result?.routes ?? []} zones={zones} onPick={pick} />
      </div>

      <div className="order-1 space-y-4 lg:order-2">
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">Where are you going?</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Tap the map to set {picking === "start" ? "your starting point" : "your destination"}.
          </p>

          <div className="mt-4 space-y-2">
            <PointRow
              icon={MapPin}
              label="From"
              coords={start}
              active={picking === "start"}
              onPickAgain={() => setPicking("start")}
            />
            <PointRow
              icon={Flag}
              label="To"
              coords={end}
              active={picking === "end"}
              onPickAgain={() => setPicking("end")}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
            >
              {locating ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="size-4" aria-hidden />
              )}
              Start from my location
            </button>
            <button
              type="button"
              onClick={findRoute}
              disabled={!start || !end || checking}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-500 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {checking ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Route className="size-4" aria-hidden />
              )}
              {result ? "Check again" : "Find a safe route"}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {checkedAt && !error && (
            <p className="mt-3 text-xs text-ink-subtle">Checked at {checkedAt.toLocaleTimeString()}</p>
          )}
          {zonesChanged && (
            <button
              type="button"
              onClick={findRoute}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
            >
              <RotateCw className="size-3.5" aria-hidden />
              The danger areas have changed. Check this route again.
            </button>
          )}
        </section>

        {result && (
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
            <p
              className={`flex gap-2 rounded-xl p-3 text-sm ${
                recommended?.risk === "clear"
                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  : "bg-amber-500/10 text-amber-800 dark:text-amber-200"
              }`}
            >
              {recommended?.risk === "clear" ? (
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              {result.advice}
            </p>

            <ul className="mt-4 space-y-2">
              {result.routes.map((route, index) => (
                <li
                  key={`${route.label}-${index}`}
                  // The pick of a bad set of options still crosses a danger area, so only
                  // a genuinely clear route gets the reassuring green.
                  className={`rounded-xl border p-3 ${
                    !route.recommended
                      ? "border-line"
                      : route.risk === "clear"
                        ? "border-emerald-500/60 bg-emerald-500/5"
                        : "border-amber-500/60 bg-amber-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {route.recommended &&
                        (route.risk === "clear" ? (
                          <CircleCheck className="size-4 text-emerald-600" aria-hidden />
                        ) : (
                          <TriangleAlert className="size-4 text-amber-600" aria-hidden />
                        ))}
                      {route.label}
                    </span>
                    <span className="text-xs text-ink-muted tabular-nums">
                      {route.distance_km} km · {formatDuration(route.duration_min)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs">
                    {route.risk === "clear" ? (
                      <span className="text-emerald-700 dark:text-emerald-300">Stays clear of every danger area</span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-300">
                        {route.zone_km} km inside{" "}
                        {route.zones.length === 1 ? "a danger area" : `${route.zones.length} danger areas`}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <ZoneList zones={zones} highlighted={[...(result?.start_zones ?? []), ...(result?.end_zones ?? [])]} />
      </div>
    </div>
  );
}

// Changes to this string mean the danger areas moved since the route was planned.
function signature(zones: DangerZone[]) {
  return [...zones]
    .map((zone) => `${zone.id}:${zone.updated_at}`)
    .sort()
    .join("|");
}

function PointRow({
  icon: Icon,
  label,
  coords,
  active,
  onPickAgain,
}: {
  icon: typeof MapPin;
  label: string;
  coords: Coords | null;
  active: boolean;
  onPickAgain: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPickAgain}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
        active ? "border-ink bg-surface-muted" : "border-line"
      }`}
    >
      <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="min-w-0">
        <span className="block text-xs font-semibold tracking-wide text-ink-subtle uppercase">{label}</span>
        <span className="block truncate font-mono text-xs">
          {coords ? formatCoords(coords.latitude, coords.longitude) : active ? "Tap the map" : "Not set"}
        </span>
      </span>
    </button>
  );
}

function ZoneList({ zones, highlighted }: { zones: DangerZone[]; highlighted: number[] }) {
  if (zones.length === 0) {
    return (
      <section className="rounded-3xl border border-line bg-surface p-5 text-sm text-ink-muted shadow-sm">
        <span className="flex items-center gap-2 font-medium text-ink">
          <ShieldCheck className="size-4 text-emerald-500" aria-hidden />
          No danger areas right now
        </span>
        <p className="mt-1">Areas appear here as soon as reports of trouble come in from the same place.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="font-semibold">Danger areas to avoid</h2>
      <ul className="mt-3 space-y-2.5">
        {zones.map((zone) => {
          const severity = SEVERITY_INFO[zone.severity] ?? SEVERITY_INFO.watch;
          return (
            <li key={zone.id} className="flex items-start gap-2.5 text-sm">
              <span
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg"
                style={{ backgroundColor: `${severity.color}1f` }}
              >
                <HazardIcon hazard={zone.hazard} className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{zone.title}</span>
                <span className="block text-xs text-ink-muted">
                  {severity.label} · {hazardLabel(zone.hazard)} · {zone.radius_km} km radius
                  {highlighted.includes(zone.id) && (
                    <span className="font-semibold text-amber-700 dark:text-amber-300"> · your route starts or ends here</span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
