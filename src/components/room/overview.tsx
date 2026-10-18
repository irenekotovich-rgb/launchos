import { Countdown } from "./countdown";
import { Pill } from "./section";
import { fmtDay, fmtDayYear } from "@/lib/format";
import {
  currentPhase,
  isFullyRolledOut,
  phaseState,
  progressPercent,
  projectedEndDate,
  rolledOutPercent,
  type PhaseState,
} from "@/lib/launch-status";
import type { LaunchDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<PhaseState, string> = { done: "Done", active: "In progress", upcoming: "Upcoming", overdue: "Overdue" };
const STATE_DOT: Record<PhaseState, string> = {
  done: "bg-success border-success",
  active: "bg-primary border-primary ring-4 ring-primary/25",
  upcoming: "bg-background border-muted-foreground",
  overdue: "bg-brand-orange border-brand-orange ring-4 ring-brand-orange/25",
};

export function Overview({ doc, now, liveClock = true }: { doc: LaunchDoc; now: Date; liveClock?: boolean }) {
  const current = currentPhase(doc);
  const projected = projectedEndDate(doc, now);
  const slipped = projected.getTime() > Date.parse(doc.brief.targetDate);
  const percent = rolledOutPercent(doc);
  const full = isFullyRolledOut(doc);
  const progress = progressPercent(doc);

  return (
    <section id="overview" aria-labelledby="overview-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="info">Tier {doc.tier.tier}</Pill>
          {full ? <Pill tone="good">Rolled out to 100%</Pill> : <Pill tone="muted">{percent}% of audience live</Pill>}
        </div>
        <h1 id="overview-title" className="break-words text-3xl font-extrabold tracking-tight sm:text-5xl">
          {doc.brief.productName}
        </h1>
        <p className="max-w-3xl text-muted-foreground">{doc.brief.what}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="surface flex flex-col gap-4 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Countdown to launch day</h2>
            <p className="text-sm">
              {slipped ? (
                <>
                  <span className="text-muted-foreground line-through">{fmtDayYear(doc.brief.targetDate)}</span>{" "}
                  <span className="font-semibold text-brand-orange">now {fmtDayYear(projected)}</span>
                </>
              ) : (
                <span className="font-semibold">{fmtDayYear(projected)}</span>
              )}
            </p>
          </div>
          {current && phaseState(current, current, now) === "overdue" ? (
            <p role="status" className="text-xl font-bold text-brand-orange">
              Launch day is slipping: {current.name} is past its ETA, so every open day moves launch by a day.
            </p>
          ) : (
            <Countdown target={projected.toISOString()} initialNow={now.toISOString()} live={liveClock} />
          )}
          <p className="text-xs text-muted-foreground">Launch day = 100% rollout. Projection moves if the current phase runs past its ETA. Dates in UTC.</p>
        </div>

        <div className="surface flex flex-col gap-4 rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Where we are</h2>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Current phase</p>
              <p className="truncate text-xl font-bold">{current ? current.name : "All phases complete"}</p>
              {current && <p className="text-sm text-muted-foreground">ETA {fmtDayYear(current.eta)}</p>}
            </div>
            <p className="font-mono text-3xl font-bold text-primary">{progress}%</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-brand-orange" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Share of the six phases closed.</p>
        </div>
      </div>

      <div className="surface rounded-2xl p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Phases & ETAs</h2>
        <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {doc.phases.map((p) => {
            const state = phaseState(p, current, now);
            return (
              <li key={p.key} className="flex gap-3 sm:flex-col sm:gap-2">
                <span className={cn("mt-1 size-3 shrink-0 rounded-full border-2 sm:mt-0", STATE_DOT[state])} aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {state === "done" && p.completedAt ? `Closed ${fmtDay(p.completedAt)}` : `ETA ${fmtDay(p.eta)}`}
                  </p>
                  <p className={cn("text-xs font-semibold", state === "overdue" ? "text-brand-orange" : state === "active" ? "text-primary" : "text-muted-foreground")}>
                    {STATE_LABEL[state]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
