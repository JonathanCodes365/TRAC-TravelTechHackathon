"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, CircleCheck, LoaderCircle, LocateFixed, MapPin, Send, X } from "lucide-react";
import { StatusBadge, TypeBadge, TypeIcon } from "@/components/ReportBadges";
import { api, errorText } from "@/lib/api";
import { formatCoords } from "@/lib/format";
import { REPORT_TYPES, TYPE_INFO, type Coords, type Report, type ReportType } from "@/lib/reports";

const MAX_MESSAGE = 1000;

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
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
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
        setCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Tap the map to mark your spot instead."
            : "Couldn’t get your location. Try again, or tap the map.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
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
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      setSent(report);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  }

  function startOver() {
    setType(null);
    setMessage("");
    setLocation("");
    setCoords(null);
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
      </Step>

      <Step number={3} title="Where are you?" optional>
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

        <div className="mt-3 overflow-hidden rounded-2xl border border-line">
          <div className="relative isolate h-56">
            <LocationPicker value={coords} onChange={setCoords} />
            {!coords && (
              <p className="pointer-events-none absolute inset-x-0 top-2.5 z-[1000] mx-auto w-fit rounded-full bg-surface/90 px-3 py-1 text-xs text-ink-muted shadow-sm backdrop-blur">
                Tap the map to mark your spot
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface-muted/60 px-3 py-2.5">
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-line-strong disabled:opacity-60"
            >
              {locating ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="size-4" aria-hidden />
              )}
              {locating ? "Finding you…" : "Use my location"}
            </button>
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
