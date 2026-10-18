import { EmptyState, Pill, Section } from "./section";
import { fmtDay } from "@/lib/format";
import type { AnalysisKey, LaunchDoc } from "@/lib/types";

const LABELS: Record<AnalysisKey, string> = {
  context: "Context",
  environment: "Environment",
  competitors: "Competitors",
  economics: "Economics",
  capacity: "Company capacity",
  audience: "Target audience",
};

export function AnalysisSection({ doc }: { doc: LaunchDoc }) {
  const entries = (Object.keys(LABELS) as AnalysisKey[]).map((k) => [k, doc.analysis.fields[k]] as const);
  const filled = entries.filter(([, f]) => f.text.trim()).length;
  return (
    <Section
      id="analysis"
      title="1 · Analysis"
      kicker={doc.analysis.completedAt ? `Completed ${fmtDay(doc.analysis.completedAt)}` : `${filled} of 6 filled`}
    >
      {filled === 0 ? (
        <EmptyState>Not started. Fill context, environment, competitors, economics, capacity and audience before alignment.</EmptyState>
      ) : (
        <dl className="grid gap-3 md:grid-cols-2">
          {entries.map(([k, f]) => (
            <div key={k} className="rounded-xl border border-border bg-background/30 p-4">
              <dt className="flex flex-wrap items-center gap-2 font-semibold">
                {LABELS[k]}
                {f.source === "ai-draft" && <Pill tone="warn">AI draft — review before publishing</Pill>}
              </dt>
              <dd className="mt-1.5 break-words text-sm text-muted-foreground">{f.text.trim() || "Not filled yet."}</dd>
            </div>
          ))}
        </dl>
      )}
    </Section>
  );
}
