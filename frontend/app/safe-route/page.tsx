import type { Metadata } from "next";
import SafeRoutePlanner from "@/components/SafeRoutePlanner";

export const metadata: Metadata = {
  title: "Safe route",
};

export default function SafeRoutePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find a safe route</h1>
      <p className="mt-1.5 mb-5 max-w-2xl text-sm text-ink-muted">
        Set where you are and where you want to go. TRAC checks the route against the disaster areas it is
        tracking right now, and suggests a way around them.
      </p>
      <SafeRoutePlanner />
    </div>
  );
}
