// A place someone typed the name of, matched to a spot on the map by the backend.
export type Place = {
  name: string;
  detail: string | null;
  latitude: number;
  longitude: number;
  // Where the match came from: coordinates typed straight in, a danger area TRAC is
  // tracking, the places on existing reports, or the map's own search.
  source: "coordinates" | "zone" | "report" | "map";
};

export const PLACE_SOURCE_LABEL: Record<Place["source"], string> = {
  coordinates: "Coordinates",
  zone: "Danger area",
  report: "From reports",
  map: "Map",
};
