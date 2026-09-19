"use client";

import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";

// Most reports come from Nepal, so maps start there until there are pins to show.
export const DEFAULT_CENTER: [number, number] = [28.3949, 84.124];
export const DEFAULT_ZOOM = 7;

// OpenStreetMap tiles need no API key. In dark mode, globals.css darkens them with a filter.
export function MapTiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
  );
}

// Leaflet only notices window resizes. This keeps the map filled when its box
// changes size for other reasons (a panel opening, a scrollbar, a phone rotating).
export function TrackSize() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}
