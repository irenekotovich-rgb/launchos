import { CheckCircle2, CircleDashed, PauseCircle, Radio } from "lucide-react";
import { RecipientForm, RecipientRemove } from "./editors";
import { Pill, Section } from "./section";
import { StageMessage } from "./stage-message";
import { fmtDay } from "@/lib/format";
import { READING_MAX_AGE_LABEL, incrementOf, isFullyRolledOut, rolledOutPercent, stageGate } from "@/lib/launch-status";
import { composeStageMessage } from "@/lib/notify";
import type { LaunchDoc, RolloutStage, RolloutStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS: Record<RolloutStatus, { label: string; tone: "good" | "info" | "bad" | "muted"; Icon: typeof Radio }> = {
  complete: { label: "Complete", tone: "good", Icon: CheckCircle2 },
  live: { label: "Live", tone: "info", Icon: Radio },
  halted: { label: "Halted", tone: "bad", Icon: PauseCircle },
  "not-started": { label: "Not started", tone: "muted", Icon: CircleDashed },
};

function GateLine({ doc, stage, now }: { doc: LaunchDoc; stage: RolloutStage; now: Date }) {
  if (stage.status === "not-started") return null;
  const g = stageGate(doc, stage, now);
  if (g.overridden) return <p className="text-sm text-warning">Gate overridden (logged decision)</p>;
  if (g.noFailureMetrics) return <p className="text-sm text-warning">No failure metrics agreed — nothing to gate on</p>;
  if (g.breached.length) return <p className="text-sm text-destructive">Gate failing: {g.breached.length} metric(s) breached</p>;
  if (g.missing.length || g.stale.length)
    return <p className="text-sm text-warning">Gate waiting: {g.missing.length + g.stale.length} reading(s) missing or older than {READING_MAX_AGE_LABEL}</p>;
  return (
    <p className="text-sm text-success">
      Gate passing{g.near.length ? <span className="text-warning"> · {g.near.length} near threshold</span> : null}
    </p>
  );
}

export function RolloutSection({ doc, now, editable = false }: { doc: LaunchDoc; now: Date; editable?: boolean }) {
  const percent = rolledOutPercent(doc);
  const full = isFullyRolledOut(doc);
  const leads = doc.rollout.recipients;
  return (
    <Section id="rollout" title="Staged rollout" kicker={full ? "100% of the audience" : `${percent}% of the audience live`}>
      {full && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 font-semibold text-success">
          <CheckCircle2 className="size-5" aria-hidden /> Rolled out to 100% of the audience
        </p>
      )}
      <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${percent}% of the audience has the feature`}>
        {doc.rollout.stages.map((s) => (
          <div
            key={s.cumulative}
            style={{ width: `${incrementOf(s.cumulative)}%` }}
            className={cn(
              "h-full border-r-2 border-card last:border-r-0",
              s.status === "complete" ? "bg-success" : s.status === "live" ? "bg-primary" : s.status === "halted" ? "bg-destructive" : "bg-transparent",
            )}
          />
        ))}
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {doc.rollout.stages.map((stage) => {
          const st = STATUS[stage.status];
          return (
            <li
              key={stage.cumulative}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-background/30 p-4",
                stage.status === "live" ? "border-primary/60" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-2xl font-bold">{stage.cumulative}%</p>
                  <p className="text-xs text-muted-foreground">+{incrementOf(stage.cumulative)}% of audience</p>
                </div>
                <Pill tone={st.tone}>
                  <st.Icon className="mr-1 size-3.5" aria-hidden /> {st.label}
                </Pill>
              </div>
              <p className="text-sm text-muted-foreground">
                {stage.completedAt
                  ? `${fmtDay(stage.startedAt!)} → ${fmtDay(stage.completedAt)}`
                  : stage.startedAt
                    ? `Started ${fmtDay(stage.startedAt)}`
                    : `Planned ${fmtDay(stage.plannedStart)}`}
              </p>
              <GateLine doc={doc} stage={stage} now={now} />
              {stage.status === "complete" && (
                <>
                  <p className="text-sm">
                    {stage.notifiedAt ? (
                      <span className="text-success">Stage message sent {fmtDay(stage.notifiedAt)}</span>
                    ) : (
                      <span className="text-warning">Stage message not sent yet</span>
                    )}
                  </p>
                  <StageMessage
                    message={composeStageMessage(doc, stage, now)}
                    label={stage.notifiedAt ? "View the message" : "Compose stage message"}
                  />
                </>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold">Stage messages go to</h3>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipients yet. Add the stakeholder group and every involved team lead.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {leads.map((r) => (
              <li key={r.email} className="rounded-full border border-border px-3 py-1 text-xs">
                <span className="font-semibold">{r.name}</span>{" "}
                <span className="text-muted-foreground">· {r.role} · {r.group === "stakeholder" ? "stakeholder" : "team lead"}</span>
                {editable && <RecipientRemove email={r.email} name={r.name} />}
              </li>
            ))}
          </ul>
        )}
        {editable && <RecipientForm />}
      </div>
    </Section>
  );
}
