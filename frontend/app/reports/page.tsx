import { redirect } from "next/navigation";

// /reports on its own has no page; the list of reports lives on the dashboard.
export default function ReportsIndexPage() {
  redirect("/dashboard");
}
