import { EmptyState, Section } from "./section";
import { fmtDayYear } from "@/lib/format";
import type { LaunchDoc } from "@/lib/types";

export function DecisionsSection({ doc }: { doc: LaunchDoc }) {
  const items = [...doc.decisions].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return (
    <Section id="decisions" title="Decisions log" kicker={`${items.length} logged`}>
      {items.length === 0 ? (
        <EmptyState>No decisions logged yet. Every judgment call gets one dated line here.</EmptyState>
      ) : (
        <ol className="flex flex-col">
          {items.map((d) => (
            <li key={d.id} className="grid gap-1 border-b border-border py-2.5 text-sm last:border-0 sm:grid-cols-[8rem_1fr]">
              <span className="font-mono text-xs text-muted-foreground sm:pt-0.5">{fmtDayYear(d.date)}</span>
              <span className="break-words">
                {d.text} <span className="text-muted-foreground">— {d.author}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
