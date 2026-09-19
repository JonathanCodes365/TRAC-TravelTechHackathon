import type { Metadata } from "next";
import { Activity, MapPin, MessageSquareText, Phone, Siren } from "lucide-react";
import ReportForm from "@/components/ReportForm";

export const metadata: Metadata = {
  title: "Send a report",
};

const TIPS = [
  {
    icon: MapPin,
    title: "Share where you are",
    text: "Use GPS or tap the map. A precise spot is the fastest way for teams to find you.",
  },
  {
    icon: MessageSquareText,
    title: "Say who and what",
    text: "How many people, any injuries, and what you need most.",
  },
  {
    icon: Activity,
    title: "Follow your report",
    text: "After sending, you get a page that shows when a team is responding.",
  },
];

export default function ReportPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-14">
      <section className="lg:pt-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
          <Siren className="size-3.5" aria-hidden />
          Emergency reporting
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Need help? Tell the rescue team.
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-muted">
          Your report goes straight to the coordinators’ live map, so they can send the right help to the
          right place.
        </p>

        <ul className="mt-8 hidden space-y-5 lg:block">
          {TIPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-muted shadow-sm">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-ink-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm lg:mt-10">
          <Phone className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="text-ink-muted">
            <strong className="font-semibold text-ink">In immediate danger?</strong> Call local emergency
            services as well. This form doesn’t replace an emergency call.
          </p>
        </div>
      </section>

      <ReportForm />
    </div>
  );
}
