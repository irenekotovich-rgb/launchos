import { Check, Circle } from "lucide-react";
import { EmptyState, Section } from "./section";
import type { LaunchDoc } from "@/lib/types";

export function PlanSection({ doc }: { doc: LaunchDoc }) {
  const done = doc.checklist.filter((c) => c.done).length;
  const total = doc.checklist.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Section id="plan" title="Readiness checklist" kicker={`${done} of ${total} done · ${pct}%`}>
      {total === 0 ? (
        <EmptyState>No checklist items. They are derived from the tier when the launch is created.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {doc.phases.map((phase) => {
            const items = doc.checklist.filter((c) => c.phase === phase.key);
            if (!items.length) return null;
            return (
              <div key={phase.key}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{phase.name}</h3>
                <ul className="flex flex-col gap-1.5">
                  {items.map((c) => (
                    <li key={c.id} className="flex gap-3 rounded-lg px-1 py-1 text-sm">
                      {c.done ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Open" />
                      )}
                      <div className="min-w-0">
                        <p className={c.done ? "break-words text-muted-foreground" : "break-words font-medium"}>{c.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.owner}
                          {c.note && <> · {c.note}</>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
