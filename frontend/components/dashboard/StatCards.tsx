import type { ReactNode } from "react";
import { Activity, CircleCheck, CircleDot, Hourglass, type LucideIcon } from "lucide-react";
import { parseDate } from "@/lib/format";
import { REPORT_TYPES, STATUS_INFO, TYPE_INFO, isUrgent, type Report } from "@/lib/reports";

type Props = { reports: Report[]; now: number; loading: boolean };

export default function StatCards({ reports, now, loading }: Props) {
  const count = (status: Report["status"]) => reports.filter((r) => r.status === status).length;
  const total = reports.length;
  const resolved = count("resolved");
  const urgent = reports.filter(isUrgent).length;
  const lastHour = reports.filter((r) => {
    const created = parseDate(r.created_at);
    return created !== null && now - created.getTime() < 3_600_000;
  }).length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Open"
        value={count("open")}
        icon={CircleDot}
        color={STATUS_INFO.open.color}
        hint={urgent ? `${urgent} urgent: rescue or injured` : "Nothing urgent waiting"}
        alert={urgent > 0}
        loading={loading}
      />
      <StatCard
        label="In progress"
        value={count("in_progress")}
        icon={Hourglass}
        color={STATUS_INFO.in_progress.color}
        hint="Teams responding"
        loading={loading}
      />
      <StatCard
        label="Resolved"
        value={resolved}
        icon={CircleCheck}
        color={STATUS_INFO.resolved.color}
        hint={total ? `${Math.round((resolved / total) * 100)}% of all reports` : "None yet"}
        loading={loading}
      />
      <StatCard
        label="All reports"
        value={total}
        icon={Activity}
        color="#64748b"
        hint={`${lastHour} in the last hour`}
        loading={loading}
      >
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-muted">
          {REPORT_TYPES.map((type) => {
            const n = reports.filter((r) => r.type === type).length;
            if (!n) return null;
            return (
              <div
                key={type}
                title={`${TYPE_INFO[type].label}: ${n}`}
                style={{ width: `${(n / total) * 100}%`, backgroundColor: TYPE_INFO[type].color }}
              />
            );
          })}
        </div>
      </StatCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
  alert = false,
  loading,
  children,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  color: string;
  alert?: boolean;
  loading: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border bg-surface p-4 shadow-sm ${alert ? "border-red-500/40" : "border-line"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-muted">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg" style={{ backgroundColor: `${color}1f` }}>
          <Icon className="size-4" style={{ color }} aria-hidden />
        </span>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {loading ? <span className="inline-block h-8 w-10 animate-pulse rounded-md bg-surface-muted" /> : value}
      </div>
      <p className={`mt-1 text-xs ${alert ? "font-medium text-red-600 dark:text-red-400" : "text-ink-muted"}`}>
        {loading ? " " : hint}
      </p>
      {children}
    </div>
  );
}
