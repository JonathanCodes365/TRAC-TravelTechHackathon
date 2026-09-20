"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, CircleCheck, LoaderCircle, LocateFixed, MapPin, Send, Sparkles, Users, X } from "lucide-react";
import { StatusBadge, TypeBadge, TypeIcon } from "@/components/ReportBadges";
import { api, errorText } from "@/lib/api";
import { formatCoords } from "@/lib/format";
import { useAiSuggestion, useReport } from "@/lib/hooks";
import {
  REPORT_TYPES,
  TYPE_INFO,
  hasDuplicateSuggestion,
  type AiSuggestion,
  type Coords,
  type Report,
  type ReportType,
} from "@/lib/reports";

const MAX_MESSAGE = 1000;

async function findPlace(place: string): Promise<Coords | null> {
  const query = `${place}, Nepal`;

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
  );

  if (!response.ok) {
    throw new Error("Could not search for that place.");
  }

  const results = await response.json();

  if (!results.length) {
    return null;
  }

  return {
    latitude: Number(Number(results[0].lat).toFixed(6)),
    longitude: Number(Number(results[0].lon).toFixed(6)),
  };
}

// Leaflet needs `window`, so the map only renders in the browser.
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-muted" />,
});

const inputClass =
  "block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink shadow-sm placeholder:text-ink-subtle focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20";

export default function ReportForm() {
  const [type, setType] = useState<ReportType | null>(null);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [reporterCoords, setReporterCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Report | null>(null);

  function locateMe() {
    setLocationError(null);
    // Browsers only share location on https:// pages and on localhost.
    if (!window.isSecureContext) {
      setLocationError("Location only works on https:// or localhost. Tap the map instead.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocationError("This browser can’t share its location. Tap the map instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setReporterCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can still send the report."
            : "Couldn’t get your location. You can still send the report.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function searchPlace() {
    const place = location.trim();

    if (!place) {
      setLocationError("Enter a place name first.");
      return;
    }

    setLocationError(null);
    setSearchingPlace(true);

    try {
      const found = await findPlace(place);

      if (!found) {
        setLocationError(`Couldn’t find "${place}". Try a more specific place name.`);
        return;
      }

      setCoords(found);
    } catch {
      setLocationError("Couldn’t search for that place. Try again or tap the map.");
    } finally {
      setSearchingPlace(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) {
      setError("Choose what kind of report this is.");
      return;
    }
    if (!message.trim()) {
      setError("Describe what’s happening.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const report = await api.createReport({
        type,
        message: message.trim(),
        location: location.trim() || null,
        incident_latitude: coords?.latitude ?? null,
        incident_longitude: coords?.longitude ?? null,

        reporter_latitude: reporterCoords?.latitude ?? null,
        reporter_longitude: reporterCoords?.longitude ?? null,
      });
      setSent(report);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  }

  async function applySuggestion(suggestion: AiSuggestion["suggested_report"]) {
    if (suggestion.type) {
      setType(suggestion.type);
    }

    if (suggestion.location && !location.trim()) {
      setLocation(suggestion.location);

      try {
        const found = await findPlace(suggestion.location);

        if (found) {
          setCoords(found);
        }
      } catch {
        // If geocoding fails, the place name is still filled in.
        // The user can manually search for it or tap the map.
      }
    }
  }

  function startOver() {
    setType(null);
    setMessage("");
    setLocation("");
    setCoords(null);
    setReporterCoords(null);
    setLocationError(null);
    setError(null);
    setSent(null);
  }

  if (sent) {
    return (
      <div role="status" className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="size-8" aria-hidden />
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight">Report #{sent.id} sent</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <TypeBadge type={sent.type} />
          <StatusBadge status={sent.status} />
        </div>
        <p className="mt-4 text-ink-muted">
          Coordinators can see it on their live map now. Keep the tracking page open to see when a team is
          responding.
        </p>
        <SentAiCheck id={sent.id} />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/reports/${sent.id}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-surface hover:opacity-90"
          >
            Track report #{sent.id}
          </Link>
          <button
            type="button"
            onClick={startOver}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold hover:bg-surface-muted"
          >
            Send another report
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-8 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7"
    >
      <Step number={1} title="What’s happening?">
        <div className="grid grid-cols-2 gap-3">
          {REPORT_TYPES.map((value) => {
            const info = TYPE_INFO[value];
            const selected = type === value;
            return (
              <label
                key={value}
                className={`relative flex cursor-pointer gap-3 rounded-2xl border-2 p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose-500/40 ${
                  // Rescue gets a full-width row. On phones the others put the icon above the text.
                  value === "rescue" ? "col-span-2 items-center" : "flex-col sm:flex-row sm:items-start"
                } ${selected ? "" : "border-line hover:border-line-strong"}`}
                style={selected ? { borderColor: info.color, backgroundColor: `${info.color}14` } : undefined}
              >
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={selected}
                  onChange={() => setType(value)}
                  className="sr-only"
                />
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-xl"
                  style={{ backgroundColor: `${info.color}1f` }}
                >
                  <TypeIcon type={value} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{info.label}</span>
                  <span className="block text-sm leading-snug text-ink-muted">{info.hint}</span>
                </span>
                {selected && (
                  <span
                    className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full text-white"
                    style={{ backgroundColor: info.color }}
                  >
                    <Check className="size-3.5" aria-hidden />
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </Step>

      <Step number={2} title="Tell us more">
        <label htmlFor="message" className="sr-only">
          Details
        </label>
        <textarea
          id="message"
          rows={4}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened? How many people? Any injuries? What do you need?"
          className={inputClass}
        />
        <p className="mt-1.5 text-right text-xs text-ink-subtle tabular-nums">
          {message.length}/{MAX_MESSAGE}
        </p>
        <div className="mt-1">
          <AiAssist message={message} chosenType={type} placeFilled={location.trim() !== ""} onApply={applySuggestion} />
        </div>
      </Step>

      <Step number={3} title="Where is the incident?" optional>
        <div>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
            <label htmlFor="location" className="sr-only">
              Place name
            </label>
            <input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Place name, e.g. Lakeside, Pokhara"
              autoComplete="off"
              maxLength={200}
              className={`${inputClass} pl-10`}
            />
          </div>
          <button
            type="button"
            onClick={searchPlace}
            disabled={searchingPlace || !location.trim()}
            className="mt-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-line-strong disabled:opacity-60"
          >
            {searchingPlace ? "Finding place..." : "Find on map"}
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-line">
          <div className="relative isolate h-56">
            <LocationPicker value={coords} onChange={setCoords} />
            {!coords && (
              <p className="pointer-events-none absolute inset-x-0 top-2.5 z-[1000] mx-auto w-fit rounded-full bg-surface/90 px-3 py-1 text-xs text-ink-muted shadow-sm backdrop-blur">
                Tap the map to mark the incident location.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface-muted/60 px-3 py-2.5">
            {coords ? (
              <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
                <span className="font-mono text-xs">{formatCoords(coords.latitude, coords.longitude)}</span>
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  className="rounded-md p-0.5 text-ink-subtle hover:bg-surface hover:text-ink"
                  aria-label="Clear map location"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </span>
            ) : (
              <span className="text-xs text-ink-subtle">No spot marked yet</span>
            )}
          </div>
        </div>
        {locationError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{locationError}</p>}
      </Step>

      <Step number={4} title="Where are you reporting from?" optional>
        <div className="rounded-2xl border border-line bg-surface-muted/60 p-4">
          <p className="text-sm text-ink-muted">
            This helps coordinators understand where the report came from. It is separate from the incident location.
          </p>

          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-line-strong disabled:opacity-60"
          >
            {locating ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <LocateFixed className="size-4" aria-hidden />
            )}
            {locating ? "Finding you…" : "Use my location"}
          </button>

          {reporterCoords ? (
            <span className="mt-3 inline-flex items-center gap-2 text-sm text-ink-muted">
              <span className="font-mono text-xs">
                {formatCoords(reporterCoords.latitude, reporterCoords.longitude)}
              </span>
              <button
                type="button"
                onClick={() => setReporterCoords(null)}
                className="rounded-md p-0.5 text-ink-subtle hover:bg-surface hover:text-ink"
                aria-label="Clear reporter location"
              >
                <X className="size-4" aria-hidden />
              </button>
            </span>
          ) : (
            <p className="mt-2 text-xs text-ink-subtle">No reporter location marked yet</p>
          )}
        </div>
      </Step>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-rose-600 to-orange-500 text-base font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:brightness-110 disabled:opacity-60"
      >
        {sending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <Send className="size-5" aria-hidden />
        )}
        {sending ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}

// While someone types, the AI suggests a report type and picks out people and places.
function AiAssist({
  message,
  chosenType,
  placeFilled,
  onApply,
}: {
  message: string;
  chosenType: ReportType | null;
  placeFilled: boolean;
  onApply: (suggestion: AiSuggestion["suggested_report"]) => void;
}) {
  const { data, error, isValidating, active, typing } = useAiSuggestion(message);

  if (!active) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Sparkles className="size-3.5" aria-hidden />
        As you type, AI suggests the report type and counts the people mentioned.
      </p>
    );
  }
  if (error) {
    return <p className="text-xs text-ink-subtle">AI suggestions are offline right now. You can still send the report.</p>;
  }
  if (!data) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        Reading your message…
      </p>
    );
  }

  const suggestion = data.suggested_report;
  const found = suggestion.type || suggestion.people_count || suggestion.location;
  const canApply =
    (suggestion.type !== null && suggestion.type !== chosenType) || (suggestion.location !== null && !placeFilled);

  return (
    <div aria-live="polite" className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
          <Sparkles className="size-3.5" aria-hidden />
          AI suggestion
          {(typing || isValidating) && <LoaderCircle className="size-3 animate-spin" aria-hidden />}
        </span>
        <span className="text-[11px] text-ink-subtle">{data.source === "model" ? "Language model" : "Keyword rules"}</span>
      </div>
      {found ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {suggestion.type && <TypeBadge type={suggestion.type} />}
          {suggestion.people_count && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium">
              <Users className="size-3.5" aria-hidden />
              {suggestion.people_count} {suggestion.people_count === 1 ? "person" : "people"}
            </span>
          )}
          {suggestion.location && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium">
              <MapPin className="size-3.5" aria-hidden />
              {suggestion.location}
            </span>
          )}
          {canApply ? (
            <button
              type="button"
              onClick={() => onApply(suggestion)}
              className="ml-auto rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
            >
              Use suggestion
            </button>
          ) : (
            suggestion.type && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" aria-hidden />
                Matches
              </span>
            )
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-ink-muted">Nothing clear yet. Say what happened, where, and how many people.</p>
      )}
    </div>
  );
}

// After sending: what the AI check found, so the reporter knows it's being handled.
function SentAiCheck({ id }: { id: number }) {
  const { data: report } = useReport(id);
  if (!report || report.ai_state === "failed" || report.ai_state === null) return null;

  if (report.ai_state === "pending") {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        AI is checking your report…
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold">
        <Sparkles className="size-4 text-violet-500" aria-hidden />
        AI check done
      </p>
      <p className="mt-1 text-ink-muted">
        {report.people_count
          ? `${report.people_count} ${report.people_count === 1 ? "person" : "people"} noted for the team.`
          : "Your report is ready for the team."}
        {hasDuplicateSuggestion(report) &&
          ` It looks like report #${report.duplicate_of}, which coordinators already have, so they can handle both together.`}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  optional = false,
  children,
}: {
  number: number;
  title: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="mb-3 w-full">
        <span className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded-full bg-ink text-[11px] font-bold text-surface">
            {number}
          </span>
          {title}
          {optional && <span className="font-normal text-ink-subtle">optional</span>}
        </span>
      </legend>
      {children}
    </fieldset>
  );
}