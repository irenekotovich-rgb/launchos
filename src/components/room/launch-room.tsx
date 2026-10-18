import Link from "next/link";
import { AlignmentSection } from "./alignment-section";
import { AnalysisSection } from "./analysis-section";
import { AssetsSection } from "./assets-section";
import { DecisionsSection } from "./decisions-section";
import { Overview } from "./overview";
import { PlanSection } from "./plan-section";
import { Suggestions } from "./suggestions";
import { bottlenecks } from "@/lib/launch-status";
import type { LaunchDoc } from "@/lib/types";

const NAV = [
  ["overview", "Overview"],
  ["analysis", "Analysis"],
  ["alignment", "Alignment"],
  ["plan", "Checklist"],
  ["assets", "Assets"],
  ["decisions", "Decisions"],
] as const;

export function DemoBanner() {
  return (
    <div role="note" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-4 py-3 text-sm">
      <p>
        <span className="font-semibold text-brand-orange">Demo launch.</span>{" "}
        &ldquo;Launch Service&rdquo; is a fictional product; people, numbers and emails are made up. Dates shift so the demo
        always sits mid-rollout.
      </p>
      <Link href="/new" className="font-semibold text-foreground underline underline-offset-4">Start your own</Link>
    </div>
  );
}

/** The launch room: renders a LaunchDoc as of `now`. Pure render; interactivity lives in child client components. */
export function LaunchRoom({ doc, now, liveClock = true }: { doc: LaunchDoc; now: Date; liveClock?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {doc.meta.mode === "demo" && <DemoBanner />}
      <nav aria-label="Launch room sections" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-2">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Overview doc={doc} now={now} liveClock={liveClock} />
      <AnalysisSection doc={doc} />
      <AlignmentSection doc={doc} />
      <PlanSection doc={doc} />
      <AssetsSection doc={doc} />
      <DecisionsSection doc={doc} />
      <Suggestions items={bottlenecks(doc, now)} storageKey={`launchos:dismissed:${doc.meta.id}`} />
    </div>
  );
}
