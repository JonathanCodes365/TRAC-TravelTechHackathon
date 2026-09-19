import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportDetail from "@/components/report/ReportDetail";

export async function generateMetadata({ params }: PageProps<"/reports/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Report #${id}` };
}

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId < 1) notFound();
  return <ReportDetail id={reportId} />;
}
