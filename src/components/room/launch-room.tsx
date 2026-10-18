import Link from "next/link";
import { AlignmentSection } from "./alignment-section";
import { AnalysisSection } from "./analysis-section";
import { AssetsSection } from "./assets-section";
import { BriefSection } from "./brief-section";
import { SharePanel } from "./editors";
import { DecisionsSection } from "./decisions-section";
import { Overview } from "./overview";
import { MetricsSection } from "./metrics-section";
import { PlanSection } from "./plan-section";
import { RolloutSection } from "./rollout-section";
import { Suggestions } from "./suggestions";
import { bottlenecks } from "@/lib/launch-status";
import type { LaunchDoc } from "@/lib/types";

const NAV = [
  ["overview", "Overview"],
  ["brief", "Brief"],
  ["analysis", "Analysis"],
  ["alignment", "Alignment"],
  ["plan", "Checklist"],
  ["rollout", "Rollout"],
  ["metrics", "Metrics"],
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

function GenerationNote({ doc }: { doc: LaunchDoc }) {
  const g = doc.meta.generation;
  if (!g) return null;
  const live = g.status === "live";
  const models = [...new Set(doc.meta.models.map((m) => m.modelId))];
  return (
    <div
      role="note"
      className={
        live
          ? "rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm"
          : "rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
      }
    >
      <p>
        <span className={live ? "font-semibold text-primary" : "font-semibold text-warning"}>
          {live ? "Generated with AI." : g.status === "budget-exhausted" ? "Daily generation budget used." : "Generation unavailable."}
        </span>{" "}
        {g.note}
      </p>
      {live && models.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Models: {models.join(", ")} · {doc.meta.models[0] && new Date(doc.meta.models[0].ranAt).toISOString().slice(0, 10)} · every output is a draft — review before publishing.
        </p>
      )}
    </div>
  );
}

/** The launch room: renders a LaunchDoc as of `now`. Pure render; interactivity lives in child client components. */
export function LaunchRoom({
  doc,
  now,
  basePath,
  liveClock = true,
  editable = false,
}: {
  doc: LaunchDoc;
  now: Date;
  /** Route prefix for sub-pages: /demo, /launch/<id> or /share/<id>. */
  basePath: string;
  liveClock?: boolean;
  editable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {doc.meta.mode === "demo" && <DemoBanner />}
      <GenerationNote doc={doc} />
      {editable && <SharePanel />}
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
      <BriefSection doc={doc} editable={editable} />
      <AnalysisSection doc={doc} basePath={basePath} editable={editable} />
      <AlignmentSection doc={doc} editable={editable} />
      <PlanSection doc={doc} editable={editable} />
      <RolloutSection doc={doc} now={now} editable={editable} />
      <MetricsSection doc={doc} editable={editable} />
      <AssetsSection doc={doc} editable={editable} />
      <DecisionsSection doc={doc} editable={editable} />
      <Suggestions items={bottlenecks(doc, now)} storageKey={`launchos:dismissed:${doc.meta.id}`} />
    </div>
  );
}
