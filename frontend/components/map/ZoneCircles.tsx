"use client";

import { Circle, Tooltip } from "react-leaflet";
import { SEVERITY_INFO, hazardLabel, type DangerZone } from "@/lib/zones";

// The disaster areas drawn on a map: a dashed circle in the colour of how serious it is.
export default function ZoneCircles({
  zones,
  onSelect,
}: {
  zones: DangerZone[];
  onSelect?: (id: number) => void;
}) {
  return (
    <>
      {zones.map((zone) => {
        const color = SEVERITY_INFO[zone.severity]?.color ?? "#f59e0b";
        return (
          <Circle
            key={zone.id}
            center={[zone.center_latitude, zone.center_longitude]}
            radius={zone.radius_km * 1000}
            pathOptions={{ color, weight: 2, dashArray: "6 5", fillColor: color, fillOpacity: 0.12 }}
            eventHandlers={onSelect ? { click: () => onSelect(zone.id) } : undefined}
          >
            <Tooltip direction="top" opacity={1}>
              <span className="font-semibold">{zone.title}</span>
              <br />
              {SEVERITY_INFO[zone.severity]?.label ?? zone.severity} · {hazardLabel(zone.hazard)} ·{" "}
              {zone.radius_km} km radius
              {zone.report_count ? ` · ${zone.report_count} reports` : ""}
            </Tooltip>
          </Circle>
        );
      })}
    </>
  );
}
