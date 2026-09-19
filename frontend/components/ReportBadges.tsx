import {
  CircleCheck,
  CircleDot,
  HeartPulse,
  Hourglass,
  LifeBuoy,
  ShieldCheck,
  TriangleAlert,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import { STATUS_INFO, TYPE_INFO, type ReportStatus, type ReportType } from "@/lib/reports";

const TYPE_ICONS: Record<ReportType, LucideIcon> = {
  rescue: LifeBuoy,
  injured: HeartPulse,
  missing: UserSearch,
  incident: TriangleAlert,
  safe: ShieldCheck,
};

const STATUS_ICONS: Record<ReportStatus, LucideIcon> = {
  open: CircleDot,
  in_progress: Hourglass,
  resolved: CircleCheck,
};

export function TypeIcon({ type, className }: { type: ReportType; className?: string }) {
  const Icon = TYPE_ICONS[type];
  return <Icon className={className} style={{ color: TYPE_INFO[type].color }} aria-hidden />;
}

export function StatusIcon({ status, className }: { status: ReportStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return <Icon className={className} style={{ color: STATUS_INFO[status].color }} aria-hidden />;
}

export function TypeBadge({ type }: { type: ReportType }) {
  const { label, color } = TYPE_INFO[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-ink"
      style={{ backgroundColor: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      <TypeIcon type={type} className="size-3.5" />
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted">
      <StatusIcon status={status} className="size-3.5" />
      {STATUS_INFO[status].label}
    </span>
  );
}
