import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { HighlightView } from "./infographic";
import { EmptyState, Section } from "./section";
import { fmtDay } from "@/lib/format";
import type { AnalysisKey, LaunchDoc } from "@/lib/types";

export const ANALYSIS_LABELS: Record<AnalysisKey, string> = {
  context: "Context",
  environment: "Environment",
  competitors: "Competitors",
  economics: "Economics",
  capacity: "Company capacity",
  audience: "Target audience",
};
export const ANALYSIS_KEYS = Object.keys(ANALYSIS_LABELS) as AnalysisKey[];

/** Six tiles, three key facts each; every tile opens its detail page. */
export function AnalysisSection({ doc, basePath, editable = false }: { doc: LaunchDoc; basePath: string; editable?: boolean }) {
  const filled = ANALYSIS_KEYS.filter((k) => doc.analysis.fields[k].text.trim() || doc.analysis.fields[k].highlights?.length).length;
  return (
    <Section
      id="analysis"
      title="Analysis"
      kicker={doc.analysis.completedAt ? `Completed ${fmtDay(doc.analysis.completedAt)}` : `${filled} of 6 filled`}
    >
      {filled === 0 && !editable ? (
        <EmptyState>Not started.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ANALYSIS_KEYS.map((k, i) => {
            const f = doc.analysis.fields[k];
            const facts = (f.highlights ?? []).slice(0, 3);
            return (
              <li key={k}>
                <Link
                  href={`${basePath}/analysis/${k}`}
                  className={`group flex h-full flex-col gap-4 rounded-2xl border p-5 transition-colors hover:border-primary/50 ${
                    i === 2 ? "surface-burgundy" : "border-border bg-background/40"
                  }`}
                  aria-label={`${ANALYSIS_LABELS[k]} — open detailed analysis`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{ANALYSIS_LABELS[k]}</h3>
                    <span className="flex items-center gap-2">
                      {f.source === "ai-draft" && <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">AI draft</span>}
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                  {facts.length ? (
                    <div className="grid grid-cols-3 gap-3">
                      {facts.map((h, j) => <HighlightView key={j} h={h} />)}
                    </div>
                  ) : (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{f.text.trim() || (editable ? "Add key facts →" : "Not filled yet.")}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
