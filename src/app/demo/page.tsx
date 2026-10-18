import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { LaunchRoom } from "@/components/room/launch-room";
import { getDemoLaunch } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Demo launch: Launch Service — LaunchOS",
  description: "A fictional launch mid-rollout: analysis, alignment, plan, staged rollout, metrics and the asset kit in one room.",
};

// Rendered per request: the demo is anchored to the current hour (see lib/demo.ts).
export const dynamic = "force-dynamic";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ now?: string }> }) {
  const { now: override } = await searchParams;
  const real = new Date();
  // `?now=` evaluates the demo at another moment (e.g. +3 days → stale readings, overdue phase) for
  // visual QA. Only honoured in development or with LAUNCHOS_QA=1, never on the hosted demo.
  const qa = process.env.NODE_ENV !== "production" || process.env.LAUNCHOS_QA === "1";
  const parsed = qa && override ? new Date(override) : null;
  const now = parsed && !Number.isNaN(parsed.getTime()) ? parsed : real;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-2">
        <LaunchRoom doc={getDemoLaunch(real)} now={now} liveClock={now === real} />
      </main>
    </>
  );
}
