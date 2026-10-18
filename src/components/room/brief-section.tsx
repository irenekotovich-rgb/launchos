import { BriefTextEditor, ClaimsEditor } from "./editors";
import { Section } from "./section";
import type { LaunchDoc } from "@/lib/types";

const ROWS = [
  ["what", "What ships"],
  ["who", "Who it's for"],
  ["whyNow", "Why now"],
] as const;

export function BriefSection({ doc, editable = false }: { doc: LaunchDoc; editable?: boolean }) {
  return (
    <Section id="brief" title="Brief" kicker={editable ? "Source of truth — editing it flags generated assets stale" : "Source of truth for every asset"}>
      <dl className="grid gap-4 md:grid-cols-2">
        {ROWS.map(([key, label]) => (
          <div key={key}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="mt-1 flex flex-col items-start gap-2 break-words">
              <span>{doc.brief[key]}</span>
              {editable && <BriefTextEditor field={key} />}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key claims</dt>
          <dd className="mt-1 flex flex-col items-start gap-2">
            <ul className="list-inside list-disc break-words">
              {doc.brief.claims.map((c) => <li key={c}>{c}</li>)}
            </ul>
            {editable && <ClaimsEditor />}
          </dd>
        </div>
      </dl>
    </Section>
  );
}
