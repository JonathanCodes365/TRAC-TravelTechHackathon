import { REPORT_TYPE_INFO, type ReportType } from "@/lib/reports";

export default function TypeBadge({ type }: { type: ReportType }) {
  const info = REPORT_TYPE_INFO[type];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-zinc-800"
      style={{ backgroundColor: `${info.color}1f` }}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: info.color }} aria-hidden />
      {info.label}
    </span>
  );
}
