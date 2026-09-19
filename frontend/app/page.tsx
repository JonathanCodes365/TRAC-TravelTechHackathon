import type { Metadata } from "next";
import ReportForm from "@/components/ReportForm";

export const metadata: Metadata = {
  title: "Send a report",
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">Send a report</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Tell rescue coordinators what’s happening. Your report shows up on their dashboard right away.
      </p>
      <ReportForm />
    </div>
  );
}
