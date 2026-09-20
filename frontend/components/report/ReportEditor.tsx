"use client";

import dynamic from "next/dynamic";
import { useState, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";
import { formatCoords } from "@/lib/format";
import { useReportActions } from "@/lib/hooks";
import {
  REPORT_TYPES,
  TYPE_INFO,
  hasCoords,
  type Coords,
  type Report,
  type ReportChanges,
  type ReportType,
} from "@/lib/reports";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface-muted" />,
});

const fieldClass =
  "mt-1.5 block w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-normal text-ink focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20";

// Edit a report's details. Only the fields that changed are sent (PATCH).
export default function ReportEditor({ report, onDone }: { report: Report; onDone: () => void }) {
  const { updateReport } = useReportActions();
  const [type, setType] = useState<ReportType>(report.type);
  const [message, setMessage] = useState(report.message);
  const [location, setLocation] = useState(report.location ?? "");
  const [coords, setCoords] = useState<Coords | null>(
    hasCoords(report) ? { latitude: report.incident_latitude, longitude: report.incident_longitude } : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setError("The message can’t be empty.");
      return;
    }

    const changes: ReportChanges = {};
    if (type !== report.type) changes.type = type;
    if (message.trim() !== report.message) changes.message = message.trim();
    const place = location.trim() || null;
    if (place !== report.location) changes.location = place;
    const latitude = coords?.latitude ?? null;
    const longitude = coords?.longitude ?? null;
    if (latitude !== report.incident_latitude || longitude !== report.incident_longitude) {
      changes.incident_latitude = latitude;
      changes.incident_longitude = longitude;
    }

    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    const saved = await updateReport(report, changes, `Report #${report.id} updated`);
    setSaving(false);
    if (saved) onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-line bg-surface-muted/50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-ink-muted">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className={fieldClass}>
            {REPORT_TYPES.map((value) => (
              <option key={value} value={value}>
                {TYPE_INFO[value].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink-muted">
          Place
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            placeholder="Not given"
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block text-xs font-semibold text-ink-muted">
        Message
        <textarea
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={fieldClass}
        />
      </label>

      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
          <span>Map location</span>
          {coords ? (
            <button
              type="button"
              onClick={() => setCoords(null)}
              className="inline-flex items-center gap-1 font-medium hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
              Remove
            </button>
          ) : (
            <span className="font-normal text-ink-subtle">Tap the map to set it</span>
          )}
        </div>
        <div className="relative isolate mt-1.5 h-44 overflow-hidden rounded-xl border border-line">
          <LocationPicker value={coords} onChange={setCoords} />
        </div>
        {coords && (
          <p className="mt-1 font-mono text-[11px] text-ink-subtle">
            {formatCoords(coords.latitude, coords.longitude)}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
        >
          {saving && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          Save changes
        </button>
      </div>
    </form>
  );
}
