"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { StatusIcon } from "@/components/ReportBadges";
import ReportEditor from "@/components/report/ReportEditor";
import { useReportActions } from "@/lib/hooks";
import { REPORT_STATUSES, STATUS_INFO, type Report, type ReportStatus } from "@/lib/reports";

// Coordinator controls for one report: change status, edit, delete.
export default function ReportActions({ report, onDeleted }: { report: Report; onDeleted?: () => void }) {
  const { updateReport, deleteReport } = useReportActions();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function changeStatus(status: ReportStatus) {
    if (status === report.status) return;
    updateReport(report, { status }, `Report #${report.id} marked as ${STATUS_INFO[status].label.toLowerCase()}`);
  }

  async function confirmDelete() {
    setConfirmingDelete(false);
    if (await deleteReport(report)) onDeleted?.();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">Response status</p>
        <div role="group" aria-label="Response status" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1">
          {REPORT_STATUSES.map((status) => {
            const active = report.status === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => changeStatus(status)}
                className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                  active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
                }`}
              >
                <StatusIcon status={status} className="size-4" />
                {STATUS_INFO[status].label}
              </button>
            );
          })}
        </div>
      </div>

      {editing ? (
        <ReportEditor report={report} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold hover:bg-surface-muted"
          >
            <Pencil className="size-4" aria-hidden />
            Edit details
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 text-sm font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete report #${report.id}?`}
        message="It disappears from the dashboard for everyone. This can’t be undone."
        confirmLabel="Delete report"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
