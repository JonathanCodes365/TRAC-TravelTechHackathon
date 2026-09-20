"use client";

import "leaflet/dist/leaflet.css";
import { latLngBounds } from "leaflet";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Polyline, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { DEFAULT_CENTER, DEFAULT_ZOOM, MapTiles, TrackSize } from "@/components/map/shared";
import ZoneCircles from "@/components/map/ZoneCircles";
import type { Coords } from "@/lib/reports";
import { formatDuration, type DangerZone, type RouteOption } from "@/lib/zones";

type Props = {
  start: Coords | null;
  end: Coords | null;
  routes: RouteOption[];
  zones: DangerZone[];
  onPick: (coords: Coords) => void;
};

// The route map: danger areas as circles, the recommended way in green, the others dashed.
export default function RouteMap({ start, end, routes, zones, onPick }: Props) {
  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full">
      <MapTiles />
      <ZoneCircles zones={zones} />

      {routes.map((route, index) => (
        <Polyline
          key={`${route.label}-${index}`}
          positions={route.geometry}
          pathOptions={{
            // Green only for a route that is genuinely clear: the best of a bad set of
            // options still goes through a danger area, and shouldn't look safe.
            color: route.risk === "clear" ? "#10b981" : route.recommended ? "#f59e0b" : "#ef4444",
            weight: route.recommended ? 6 : 4,
            opacity: route.recommended ? 0.95 : 0.55,
            dashArray: route.recommended ? undefined : "8 6",
          }}
        >
          <Tooltip sticky>
            <span className="font-semibold">{route.label}</span>
            <br />
            {route.distance_km} km · {formatDuration(route.duration_min)}
            {route.risk === "passes_zone"
              ? ` · ${route.zone_km} km inside ${route.zones.length === 1 ? "a danger area" : `${route.zones.length} danger areas`}`
              : " · clear of danger areas"}
          </Tooltip>
        </Polyline>
      ))}

      {start && (
        <CircleMarker
          center={[start.latitude, start.longitude]}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
        >
          <Tooltip direction="top">Start</Tooltip>
        </CircleMarker>
      )}
      {end && (
        <CircleMarker
          center={[end.latitude, end.longitude]}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#0f1729", fillOpacity: 1 }}
        >
          <Tooltip direction="top">Destination</Tooltip>
        </CircleMarker>
      )}

      <PickOnClick onPick={onPick} />
      <FitToRoute start={start} end={end} routes={routes} />
      <TrackSize />
    </MapContainer>
  );
}

function PickOnClick({ onPick }: { onPick: (coords: Coords) => void }) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng.wrap();
      onPick({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
    },
  });
  return null;
}

// Bring the whole journey into view when the routes change.
function FitToRoute({ start, end, routes }: { start: Coords | null; end: Coords | null; routes: RouteOption[] }) {
  const map = useMap();
  const signature = `${routes.map((route) => route.geometry.length).join("-")}|${start?.latitude},${start?.longitude}|${end?.latitude},${end?.longitude}`;
  const fitted = useRef("");

  useEffect(() => {
    if (fitted.current === signature) return;
    const points: [number, number][] = routes.flatMap((route) => route.geometry);
    if (start) points.push([start.latitude, start.longitude]);
    if (end) points.push([end.latitude, end.longitude]);
    if (points.length < 2) return;
    fitted.current = signature;
    map.fitBounds(latLngBounds(points), { padding: [40, 40] });
  }, [map, signature, routes, start, end]);

  return null;
}
