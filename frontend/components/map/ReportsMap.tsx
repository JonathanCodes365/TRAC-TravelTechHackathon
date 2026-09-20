"use client";

import "leaflet/dist/leaflet.css";
import { latLng } from "leaflet";
import { Fragment, useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Tooltip, useMap } from "react-leaflet";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MapTiles, TrackSize } from "@/components/map/shared";
import ZoneCircles from "@/components/map/ZoneCircles";
import { usePrefersDark } from "@/lib/hooks";
import type { DangerZone } from "@/lib/zones";
import {
  REPORT_TYPES,
  STATUS_INFO,
  TYPE_INFO,
  hasCoords,
  hasDuplicateSuggestion,
  isUrgent,
  type PinnedReport,
  type Report,
} from "@/lib/reports";

type Props = {
  reports: Report[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  showLegend?: boolean;
  // Disaster areas to draw, and the one to zoom to when a coordinator picks it from the list.
  zones?: DangerZone[];
  focusZoneId?: number | null;
  onSelectZone?: (id: number) => void;
};

export default function ReportsMap({
  reports,
  selectedId = null,
  onSelect,
  showLegend = true,
  zones = [],
  focusZoneId = null,
  onSelectZone,
}: Props) {
  const pins = reports.filter(hasCoords);
  const dark = usePrefersDark();
  const outline = dark ? "#0b0f16" : "#ffffff";

  return (
    <div className="relative isolate h-full w-full">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full">
        <MapTiles />
        <ZoneCircles zones={zones} onSelect={onSelectZone} />
        {pins.map((report) => {
          const color = TYPE_INFO[report.type].color;
          const selected = report.id === selectedId;
          const center: [number, number] = [report.incident_latitude, report.incident_longitude];
          return (
            <Fragment key={report.id}>
              {isUrgent(report) && (
                <CircleMarker
                  center={center}
                  radius={9}
                  interactive={false}
                  pathOptions={{ className: "pin-halo", color, weight: 0, fill: false }}
                />
              )}
              <CircleMarker
                // A new key re-adds the selected pin last, so it's drawn on top of the others.
                key={selected ? "selected" : "pin"}
                center={center}
                radius={selected ? 12 : 8}
                eventHandlers={onSelect ? { click: () => onSelect(report.id) } : undefined}
                pathOptions={{
                  color: selected ? (dark ? "#ffffff" : "#0f1729") : outline,
                  weight: selected ? 3 : 2,
                  fillColor: color,
                  fillOpacity: report.status === "resolved" ? 0.35 : 0.95,
                  // A dashed ring marks a report the AI thinks is a duplicate, until someone decides.
                  dashArray: hasDuplicateSuggestion(report) ? "3 3" : undefined,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <span className="font-semibold">{TYPE_INFO[report.type].label}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · {STATUS_INFO[report.status].label} · #{report.id}
                    {report.people_count ? ` · ${report.people_count} people` : ""}
                  </span>
                  <br />
                  {report.message.length > 70 ? `${report.message.slice(0, 70)}…` : report.message}
                  {hasDuplicateSuggestion(report) && (
                    <>
                      <br />
                      <span className="text-amber-600">Possible duplicate of #{report.duplicate_of}</span>
                    </>
                  )}
                </Tooltip>
              </CircleMarker>
            </Fragment>
          );
        })}
        <FitToPins pins={pins} />
        <FlyToSelected pins={pins} selectedId={selectedId} />
        <FlyToZone zones={zones} focusId={focusZoneId} />
        <TrackSize />
      </MapContainer>

      {showLegend && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] hidden rounded-xl border border-line bg-surface/90 px-3 py-2 text-[11px] text-ink-muted shadow-sm backdrop-blur sm:block">
          {REPORT_TYPES.map((type) => (
            <div key={type} className="flex items-center gap-2 py-0.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: TYPE_INFO[type].color }} />
              {TYPE_INFO[type].label}
            </div>
          ))}
        </div>
      )}

      {pins.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-3 z-[1000] mx-auto w-fit rounded-full border border-line bg-surface/90 px-3 py-1.5 text-xs text-ink-muted shadow-sm backdrop-blur">
          No reports with a map location yet
        </p>
      )}
    </div>
  );
}

// Zoom to the pins the first time any appear. After that, leave the view alone
// so the 10-second refresh doesn't move the map while someone is using it.
function FitToPins({ pins }: { pins: PinnedReport[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || pins.length === 0) return;

    fitted.current = true;
    if (pins.length === 1) {
      map.setView([pins[0].incident_latitude, pins[0].incident_longitude], 13);
    } else {
      map.fitBounds(
        pins.map((p) => [p.incident_latitude, p.incident_longitude] as [number, number]),
        { padding: [48, 48], maxZoom: 13 },
      );
    }
  }, [map, pins]);

  return null;
}

// Zoom to a disaster area when someone picks it from the alerts.
function FlyToZone({ zones, focusId }: { zones: DangerZone[]; focusId: number | null }) {
  const map = useMap();
  const zone = zones.find((z) => z.id === focusId);
  const latitude = zone?.center_latitude;
  const longitude = zone?.center_longitude;
  const radius = zone?.radius_km;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || radius === undefined) return;
    map.fitBounds(latLng(latitude, longitude).toBounds(radius * 2400), { maxZoom: 13 });
  }, [map, latitude, longitude, radius]);

  return null;
}

// Fly to a report when it's selected in the list.
function FlyToSelected({ pins, selectedId }: { pins: PinnedReport[]; selectedId: number | null }) {
  const map = useMap();
  const target = pins.find((p) => p.id === selectedId);
  const lat = target?.incident_latitude;
  const lng = target?.incident_longitude;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
  }, [map, lat, lng]);

  return null;
}
