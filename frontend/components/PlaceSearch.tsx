"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search, TriangleAlert, X } from "lucide-react";
import { api, errorText } from "@/lib/api";
import { PLACE_SOURCE_LABEL, type Place } from "@/lib/places";
import type { Coords } from "@/lib/reports";

type Props = {
  label: string;
  // What to show when nobody is typing: the chosen place, or its coordinates.
  display: string;
  placeholder: string;
  // True while the next tap on the map sets this point.
  pickingOnMap: boolean;
  onChoose: (coords: Coords, name: string) => void;
  onPickOnMap: () => void;
};

// A box you can type a place name into, next to the map. Matching ignores capitals, and
// coordinates pasted straight in ("27.7172, 85.3240") work too.
export default function PlaceSearch({
  label,
  display,
  placeholder,
  pickingOnMap,
  onChoose,
  onPickOnMap,
}: Props) {
  // null means "not typing": the box shows whatever is already chosen.
  const [query, setQuery] = useState<string | null>(null);
  // What came back, and what was searched for. Keeping the two together means results
  // from an earlier search are never shown against a newer one.
  const [found, setFound] = useState<{ query: string; places: Place[]; error: string | null } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  const typing = query !== null;
  const trimmed = (query ?? "").trim();
  const open = typing && trimmed.length >= 2;

  const current = found?.query === trimmed ? found : null;
  const results = current?.places ?? [];
  const error = current?.error ?? null;
  const searching = open && current === null;
  const active = Math.min(highlight, Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return;
    // Wait for a pause in typing, so one search goes out instead of one per letter.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const places = await api.searchPlaces(trimmed, controller.signal);
        if (!controller.signal.aborted) setFound({ query: trimmed, places, error: null });
      } catch (err) {
        if (!controller.signal.aborted) setFound({ query: trimmed, places: [], error: errorText(err) });
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, trimmed]);

  // Typing somewhere else, or tapping the map, puts the box back to showing the choice.
  useEffect(() => {
    if (!typing) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setQuery(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [typing]);

  function choose(place: Place) {
    onChoose(
      { latitude: Number(place.latitude.toFixed(6)), longitude: Number(place.longitude.toFixed(6)) },
      place.name,
    );
    setQuery(null);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setQuery(null);
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((index) => (Math.min(index, results.length - 1) + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  }

  return (
    <div ref={box} className="relative">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold tracking-wide text-ink-subtle uppercase">
          {label}
        </span>
        <span
          className={`flex items-center gap-2 rounded-xl border px-3 transition-colors ${
            pickingOnMap ? "border-ink bg-surface-muted" : "border-line"
          }`}
        >
          <Search className="size-4 shrink-0 text-ink-muted" aria-hidden />
          <input
            type="text"
            value={query ?? display}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            onFocus={(event) => {
              setQuery("");
              event.target.select();
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
          />
          {typing ? (
            <button
              type="button"
              onClick={() => setQuery(null)}
              aria-label="Stop typing"
              className="shrink-0 rounded-md p-1 text-ink-muted hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={onPickOnMap}
              aria-pressed={pickingOnMap}
              aria-label={`Set ${label.toLowerCase()} by tapping the map`}
              title="Tap the map instead"
              className={`shrink-0 rounded-md p-1 ${pickingOnMap ? "text-ink" : "text-ink-muted hover:text-ink"}`}
            >
              <MapPin className="size-4" aria-hidden />
            </button>
          )}
        </span>
      </label>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-1000 mt-1 max-h-64 overflow-auto rounded-xl border border-line bg-surface py-1 shadow-xl"
        >
          {searching && results.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink-muted">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Looking for “{trimmed}”…
            </li>
          )}
          {!searching && error && (
            <li className="flex items-start gap-2 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </li>
          )}
          {!searching && !error && results.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-ink-muted">
              Nothing found for “{trimmed}”. Try a nearby town, or tap the map.
            </li>
          )}
          {results.map((place, index) => (
            <li key={`${place.name}-${place.latitude}-${place.longitude}`} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(place)}
                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left ${
                  index === active ? "bg-surface-muted" : ""
                }`}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{place.name}</span>
                  {place.detail && <span className="block truncate text-xs text-ink-muted">{place.detail}</span>}
                </span>
                <span className="mt-0.5 shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-subtle uppercase">
                  {PLACE_SOURCE_LABEL[place.source]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
