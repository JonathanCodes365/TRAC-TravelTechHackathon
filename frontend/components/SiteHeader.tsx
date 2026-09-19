"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Radio, Send } from "lucide-react";
import { useApiStatus } from "@/lib/hooks";

const LINKS = [
  { href: "/", label: "Report", icon: Send },
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

        <div className="flex items-center gap-3">
          <ApiStatus />
          <nav className="flex gap-1 rounded-xl bg-surface-muted p-1 text-sm font-medium">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                    active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

function ApiStatus() {
  const status = useApiStatus();
  const label = { checking: "Connecting…", online: "Live", offline: "Offline" }[status];
  const color = { checking: "bg-ink-subtle", online: "bg-emerald-500", offline: "bg-red-500" }[status];

  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted md:inline-flex"
      title={status === "offline" ? "Can't reach the TRAC backend" : "Connected to the TRAC backend"}
    >
      <span className="relative flex size-2">
        {status === "online" && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex size-2 rounded-full ${color}`} />
      </span>
      {label}
    </span>
  );
}
