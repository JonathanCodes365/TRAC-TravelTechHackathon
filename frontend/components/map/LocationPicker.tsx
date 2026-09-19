"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, useMap, useMapEvents } from "react-leaflet";
import { DEFAULT_CENTER, MapTiles, TrackSize } from "@/components/map/shared";
import type { Coords } from "@/lib/reports";

type Props = {
  value: Coords | null;
  onChange: (coords: Coords) => void;
};

// A small map where tapping sets the report's location.
export default function LocationPicker({ value, onChange }: Props) {
  return (
    <MapContainer
      center={value ? [value.latitude, value.longitude] : DEFAULT_CENTER}
      zoom={value ? 14 : 6}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <MapTiles />
      <PickOnClick onPick={onChange} />
      <FollowValue value={value} />
      {value && (
        <CircleMarker
          center={[value.latitude, value.longitude]}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#e11d48", fillOpacity: 1 }}
        />
      )}
      <TrackSize />
    </MapContainer>
  );
}

function PickOnClick({ onPick }: { onPick: (coords: Coords) => void }) {
  useMapEvents({
    click(event) {
      // wrap() keeps the longitude between -180 and 180 when the map has scrolled around the world.
      const { lat, lng } = event.latlng.wrap();
      onPick({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
    },
  });
  return null;
}

// Move the map to the chosen spot, e.g. after "Use my location".
function FollowValue({ value }: { value: Coords | null }) {
  const map = useMap();
  const lat = value?.latitude;
  const lng = value?.longitude;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, lat, lng]);

  return null;
}
