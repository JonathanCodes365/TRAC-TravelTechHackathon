"use client";

import { useState, type FormEvent } from "react";
import { REPORT_TYPES, REPORT_TYPE_INFO, createReport, type ReportType } from "@/lib/reports";

type Coords = { latitude: number; longitude: number; accuracy: number };

const inputClass =
  "mt-2 block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base shadow-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

export default function ReportForm() {
  const [type, setType] = useState<ReportType | null>(null);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locateMe() {
    setLocationError(null);
    // Browsers only share location on https:// pages and on localhost.
    if (!window.isSecureContext) {
      setLocationError("Location only works on https:// or localhost. Type your location instead.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocationError("This browser can’t share its location. Type your location instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ latitude, longitude, accuracy });
        setLocating(false);
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Type your location instead."
            : "Couldn’t get your location. Try again, or type it instead.",
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
      await createReport({
        type,
        message: message.trim(),
        location: location.trim() || null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
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
    setSent(false);
  }

  if (sent) {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-lg font-semibold text-green-900">Report sent</h2>
        <p className="mt-1 text-sm text-green-800">Coordinators can see it on the dashboard now.</p>
        <button
          type="button"
          onClick={startOver}
          className="mt-4 rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-900 hover:bg-green-100"
        >
          Send another report
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">What’s happening?</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {REPORT_TYPES.map((value) => {
            const info = REPORT_TYPE_INFO[value];
            const selected = type === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer flex-col rounded-xl border-2 bg-white p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-900 has-[:focus-visible]:ring-offset-2 ${
                  value === "rescue" ? "col-span-2" : ""
                } ${selected ? "" : "border-zinc-200 hover:border-zinc-300"}`}
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
                <span className="flex items-center gap-2 font-semibold">
                  <span className="size-3 rounded-full" style={{ backgroundColor: info.color }} aria-hidden />
                  {info.label}
                </span>
                <span className="mt-1 text-sm text-zinc-600">{info.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="message" className="text-sm font-medium">
          Details
        </label>
        <textarea
          id="message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened? How many people? What do you need?"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="location" className="text-sm font-medium">
          Location <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Lakeside, Pokhara"
          autoComplete="off"
          className={inputClass}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            {locating ? "Finding you…" : coords ? "Update GPS location" : "Use my GPS location"}
          </button>
          {coords && (
            <span className="text-sm text-zinc-700">
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}{" "}
              <span className="text-zinc-500">(±{Math.round(coords.accuracy)} m)</span>{" "}
              <button type="button" onClick={() => setCoords(null)} className="text-zinc-500 underline">
                Remove
              </button>
            </span>
          )}
        </div>
        {locationError && <p className="mt-2 text-sm text-red-700">{locationError}</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
