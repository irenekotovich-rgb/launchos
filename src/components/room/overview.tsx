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
    <section id="overview" aria-labelledby="overview-title" className="grid gap-4 lg:grid-cols-3">
      {/* Hero tile */}
      <div className="surface flex flex-col justify-between gap-4 rounded-3xl p-6 sm:p-8 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="info">Tier {doc.tier.tier}</Pill>
          {full ? <Pill tone="good">Rolled out to 100%</Pill> : <Pill tone="muted">{percent}% of audience live</Pill>}
        </div>
        <h1 id="overview-title" className="text-chrome break-words text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
          {doc.brief.productName}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{doc.brief.what}</p>
      </div>

      {/* Countdown tile — burgundy metal */}
      <div className="surface-burgundy flex flex-col gap-4 rounded-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/75">Launch day</h2>
          <p className="text-sm text-white">
            {slipped ? (
              <>
                <span className="text-white/60 line-through">{fmtDayYear(doc.brief.targetDate)}</span>{" "}
                <span className="font-semibold text-brand-orange">now {fmtDayYear(projected)}</span>
              </>
            ) : (
              <span className="font-semibold">{fmtDayYear(projected)}</span>
            )}
          </p>
        </div>
        {current && phaseState(current, current, now) === "overdue" ? (
          <p role="status" className="text-lg font-bold text-brand-orange">
            Launch day is slipping: {current.name} is past its ETA, so every open day moves launch by a day.
          </p>
        ) : (
          <Countdown target={projected.toISOString()} initialNow={now.toISOString()} live={liveClock} />
        )}
        <p className="text-xs text-white/70">100% rollout. Moves if the current phase runs late. Dates in UTC.</p>
      </div>

      {/* Where we are — chrome progress ring */}
      <div className="surface flex items-center gap-5 rounded-3xl p-6">
        <ProgressRing value={progress} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Now</p>
          <p className="truncate text-xl font-bold">{current ? current.name : "All phases complete"}</p>
          {current && <p className="text-sm text-muted-foreground">ETA {fmtDayYear(current.eta)}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{progress}% of phases closed</p>
        </div>
      </div>

      {/* Phases tile */}
      <div className="surface rounded-3xl p-6 lg:col-span-2">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Phases & ETAs</h2>
        <ol className="grid gap-x-3 gap-y-4 sm:grid-cols-3">
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

/** Chrome ring with a wine-rose progress arc. */
function ProgressRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 84 84" className="size-24 shrink-0" role="img" aria-label={`${value}% of phases closed`}>
      <defs>
        <linearGradient id="chrome-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#8b8b94" />
          <stop offset="70%" stopColor="#e9e9ee" />
          <stop offset="100%" stopColor="#a9a9b2" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r="40" fill="none" stroke="url(#chrome-ring)" strokeWidth="2" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="47" textAnchor="middle" className="fill-foreground text-[15px] font-bold">{value}%</text>
    </svg>
  );
}
