import { AlignmentTextEditor, LockAlignment, MetricForm, MetricRemove, SignoffEditor } from "./editors";
import { EmptyState, Pill, Section } from "./section";
import { ExpectedResults } from "./expected-results";
import { METRIC_LIMITS } from "@/lib/types";
import { fmtDay } from "@/lib/format";
import { signoffList } from "@/lib/launch-status";
import type { LaunchDoc, Metric, TeamKey } from "@/lib/types";

const TEAM_LABEL: Record<TeamKey, string> = {
  stakeholders: "Stakeholders",
  rnd: "R&D",
  marketing: "Marketing",
  sales: "Sales",
  support: "Customer Support",
  legal: "Legal / Compliance",
};

function MetricList({ title, metrics, tone, editable }: { title: string; metrics: Metric[]; tone: "good" | "bad"; editable: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <span className={tone === "good" ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-destructive"} aria-hidden />
        {title}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {metrics.length} of {METRIC_LIMITS[tone === "good" ? "success" : "failure"]}
        </span>
      </h3>
      {metrics.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None agreed yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5">
          {metrics.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
              <p className="break-words font-medium">{m.name}</p>
              <p className="text-muted-foreground">
                {tone === "good" ? "Target" : "Fails"} {m.direction === "above" ? "≥" : "≤"} {m.threshold}
                {m.unit === "%" ? "%" : ` ${m.unit}`} · {m.owner}
              </p>
              </div>
              {editable && <MetricRemove metric={m} />}
            </li>
          ))}
        </ul>
      )}
      {editable && <MetricForm kind={tone === "good" ? "success" : "failure"} />}
    </div>
  );
}

export function AlignmentSection({ doc, editable = false }: { doc: LaunchDoc; editable?: boolean }) {
  const a = doc.alignment;
  const signoffs = signoffList(doc);
  const signed = signoffs.filter((s) => s.status === "signed").length;
  return (
    <Section
      id="alignment"
      title="Problem & metrics alignment"
      kicker={a.lockedAt ? `Locked ${fmtDay(a.lockedAt)} · ${signed}/6 signed` : `${signed}/6 teams signed`}
    >
      <div className="flex flex-col gap-4">
        {a.problem || editable ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Problem</p>
              <p className="mt-1 break-words">{a.problem || <span className="text-muted-foreground">Not written yet.</span>}</p>
              {editable && <AlignmentTextEditor field="problem" label="problem statement" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">For whom</p>
              <p className="mt-1 break-words">{a.forWhom}</p>
              {editable && <AlignmentTextEditor field="forWhom" label="for whom" />}
            </div>
          </div>
        ) : (
          <EmptyState>No problem statement yet. Alignment starts with one sentence everyone agrees on.</EmptyState>
        )}
        <ExpectedResults doc={doc} editable={editable} />
        <div className="grid gap-3 md:grid-cols-2">
          <MetricList title="Success metrics" metrics={a.metrics.filter((m) => m.kind === "success")} tone="good" editable={editable} />
          <MetricList title="Failure metrics" metrics={a.metrics.filter((m) => m.kind === "failure")} tone="bad" editable={editable} />
        </div>
        <div>
          <h3 className="mb-2 font-semibold">Sign-offs</h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {signoffs.map((s) => (
              <li key={s.team} className="flex flex-col gap-1 rounded-xl border border-border bg-background/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{TEAM_LABEL[s.team]}</span>
                  <Pill tone={s.status === "signed" ? "good" : s.status === "objected" ? "bad" : "muted"}>{s.status}</Pill>
                </div>
                <span className="break-words text-muted-foreground">{s.lead || "Lead not named"}</span>
                {s.note && <span className="break-words text-xs text-muted-foreground">“{s.note}”</span>}
                {editable && <SignoffEditor team={s.team} label={TEAM_LABEL[s.team]} />}
              </li>
            ))}
          </ul>
        </div>
        {editable && <LockAlignment />}
      </div>
    </Section>
  );
}
