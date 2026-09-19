"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import TypeBadge from "@/components/TypeBadge";
import { REPORT_TYPE_INFO, hasCoords, type PinnedReport, type Report } from "@/lib/reports";

// Leaflet only notices window resizes. This keeps the map filled when its box
// changes size for other reasons (a scrollbar appearing, a phone rotating).
function TrackSize() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
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
      map.setView([pins[0].latitude, pins[0].longitude], 13);
    } else {
      map.fitBounds(
        pins.map((p) => [p.latitude, p.longitude] as [number, number]),
        { padding: [40, 40], maxZoom: 14 },
      );
    }
  }, [map, pins]);

  return null;
}

export default function ReportMap({ reports }: { reports: Report[] }) {
  const pins = reports.filter(hasCoords);

  return (
    <div className="relative h-full w-full">
      <MapContainer center={[20, 0]} zoom={2} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.latitude, r.longitude]}
            radius={9}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: REPORT_TYPE_INFO[r.type].color, fillOpacity: 0.9 }}
          >
            <Popup>
              <div className="space-y-1">
                <TypeBadge type={r.type} />
                <p className="my-1! text-sm text-zinc-900">{r.message}</p>
                {r.location && <p className="my-0! text-xs text-zinc-600">{r.location}</p>}
                <p className="my-0! text-xs text-zinc-500">#{r.id}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        <TrackSize />
        <FitToPins pins={pins} />
      </MapContainer>

      {pins.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 top-3 z-[1000] mx-auto w-fit rounded-full bg-white/90 px-3 py-1 text-xs text-zinc-700 shadow">
          Pins appear for reports sent with a GPS location
        </p>
      )}
    </div>
  );
}
