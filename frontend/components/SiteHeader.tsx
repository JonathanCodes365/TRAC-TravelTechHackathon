"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, CircleX, LayoutDashboard, LoaderCircle, Radio, Route, Send } from "lucide-react";
import { useSystemHealth } from "@/lib/hooks";

const LINKS = [
  { href: "/", label: "Report", icon: Send },
  { href: "/safe-route", label: "Safe route", icon: Route },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/25">
            <Radio className="size-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight">TRAC</span>
            <span className="hidden text-xs text-ink-muted sm:block">Travel disaster coordination</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <SystemStatus />
          <nav className="flex gap-1 rounded-xl bg-surface-muted p-1 text-sm font-medium">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors sm:px-3 ${
                    active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

// A status pill that opens a small panel showing the backend, the database and the AI service.
function SystemStatus() {
  const { state, health } = useSystemHealth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const databaseOk = health?.database === "ok";
  const aiOk = health?.ai === "ok";
  const overall =
    state === "online" ? (databaseOk && aiOk ? "ok" : "degraded") : state === "offline" ? "offline" : "checking";
  const label = {
    ok: "All systems live",
    degraded: databaseOk ? "AI offline" : "Database problem",
    offline: "Offline",
    checking: "Connecting…",
  }[overall];
  const dot = { ok: "bg-emerald-500", degraded: "bg-amber-500", offline: "bg-red-500", checking: "bg-ink-subtle" }[overall];
  const aiMode = health?.ai_extraction === "rules" ? "keyword rules" : health?.ai_extraction;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`System status: ${label}`}
        className="inline-flex h-8 items-center gap-2 rounded-full border border-line px-2.5 text-xs font-medium text-ink-muted hover:text-ink"
      >
        <span className="relative flex size-2">
          {overall === "ok" && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex size-2 rounded-full ${dot}`} />
        </span>
        <span className="hidden md:inline">{label}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-xl">
          <p className="text-sm font-semibold">System status</p>
          <ul className="mt-3 space-y-3 text-sm">
            <StatusRow
              name="Backend API"
              state={state === "online" ? "ok" : state === "offline" ? "down" : "checking"}
              detail={state === "offline" ? "Can’t reach it. Is it running?" : "Port 8000"}
            />
            <StatusRow
              name="Database"
              state={!health ? (state === "offline" ? "down" : "checking") : databaseOk ? "ok" : "down"}
              detail={!health ? "Checked through the backend" : databaseOk ? "Connected" : "The backend can’t reach it"}
            />
            <StatusRow
              name="AI service"
              state={!health ? (state === "offline" ? "down" : "checking") : aiOk ? "ok" : "down"}
              detail={
                !health
                  ? "Checked through the backend"
                  : aiOk
                    ? `Running · ${aiMode ?? "ready"}`
                    : "Not running. Reports still save."
              }
            />
          </ul>
          <p className="mt-3 text-xs text-ink-subtle">Checked every 15 seconds.</p>
        </div>
      )}
    </div>
  );
}

function StatusRow({ name, state, detail }: { name: string; state: "ok" | "down" | "checking"; detail: string }) {
  return (
    <li className="flex items-start gap-2.5">
      {state === "ok" ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
      ) : state === "down" ? (
        <CircleX className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
      ) : (
        <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-ink-subtle" aria-hidden />
      )}
      <span>
        <span className="block font-medium">{name}</span>
        <span className="block text-xs text-ink-muted">{detail}</span>
      </span>
    </li>
  );
}
