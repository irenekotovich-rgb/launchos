"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, OctagonAlert, TrendingUp } from "lucide-react";
import { fmtDay, fmtValue } from "@/lib/format";
import type { MetricState } from "@/lib/launch-status";
import type { MetricSeries } from "@/lib/metric-series";
import { cn } from "@/lib/utils";


// Status always ships with an icon + label, never colour alone (dataviz rule).
const STATE: Record<MetricState, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  met: { label: "Target met", cls: "text-success", Icon: CheckCircle2 },
  "not-met": { label: "Tracking", cls: "text-muted-foreground", Icon: TrendingUp },
  ok: { label: "Healthy", cls: "text-success", Icon: CheckCircle2 },
  near: { label: "Near threshold", cls: "text-warning", Icon: AlertTriangle },
  breached: { label: "Breached", cls: "text-destructive", Icon: OctagonAlert },
  "no-data": { label: "No data", cls: "text-muted-foreground", Icon: CircleDashed },
};

const W = 280;
const H = 132;
const PAD = { top: 16, right: 12, bottom: 26, left: 12 };
const thresholdText = (s: MetricSeries) =>
  `${s.kind === "success" ? "target" : "fails at"} ${s.direction === "above" ? "≥" : "≤"} ${fmtValue(s.threshold, s.unit)}`;

function Chart({ s }: { s: MetricSeries }) {
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (hover === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHover(null); // WCAG 1.4.13
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hover]);
  const values = s.points.flatMap((p) => (p.value === null ? [] : [p.value]));
  // Zero-based scale with 15% headroom over the larger of threshold and data (metrics here are non-negative).
  const top = Math.max(s.threshold, ...values, 0);
  const min = Math.min(0, ...values);
  const max = top + (top - min) * 0.15 || 1;
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / Math.max(1, s.points.length - 1);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min || 1)) * (H - PAD.top - PAD.bottom);
  const drawn = s.points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as { stage: number; value: number; recordedAt: string; i: number }[];
  // Break the line at missing stages instead of bridging the gap.
  const path = s.points
    .map((p, i) => (p.value === null ? null : `${i > 0 && s.points[i - 1].value !== null ? "L" : "M"}${x(i)},${y(p.value)}`))
    .filter(Boolean)
    .join(" ");
  const ty = y(s.threshold);
  const thresholdLabel = thresholdText(s);
  const active = hover !== null ? s.points[hover] : null;

  return (
    <div className="relative">
      {/* One accessible image with a full text summary; the Table view is the navigable equivalent. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img"
        aria-label={`${s.name}: ${drawn.map((p) => `${p.stage}% stage ${fmtValue(p.value, s.unit)}`).join(", ") || "no readings"}; ${thresholdLabel}`}>
        {/* baseline + threshold reference (hairline, solid, recessive) */}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="stroke-border" strokeWidth={1} />
        <line x1={PAD.left} x2={W - PAD.right} y1={ty} y2={ty} stroke="var(--muted-foreground)" strokeOpacity={0.6} strokeWidth={1} />
        <text x={W - PAD.right} y={ty - 4} textAnchor="end" className="fill-muted-foreground text-[12px]">{thresholdLabel}</text>
        {path && <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {s.points.map((p, i) => (
          <g key={p.stage}>
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[12px]">{p.stage}%</text>
            {p.value !== null && (
              <circle cx={x(i)} cy={y(p.value)} r={4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
            )}
            {/* pointer hit target larger than the mark; mouse-only, the table covers keyboard/AT */}
            <rect x={x(i) - 22} y={0} width={44} height={H} fill="transparent" aria-hidden
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
        {/* direct label on the latest point only */}
        {drawn.length > 0 && hover === null && (() => {
          const last = drawn.at(-1)!;
          const px = x(last.i);
          const py = y(last.value);
          // Right of the point when there's room and it clears the threshold label (top-right);
          // otherwise above or below the point, whichever avoids the threshold line.
          const clearsThresholdLabel = Math.abs(py + 4 - (ty - 4)) >= 14;
          const right = last.i < s.points.length - 1 && clearsThresholdLabel;
          const vy = right ? py + 4 : Math.abs(py - 14 - ty) < 10 || py - 10 < 10 ? py + 18 : py - 10;
          return (
            <text x={right ? px + 9 : px} y={vy} textAnchor={right ? "start" : "middle"} className="fill-foreground text-[12px] font-semibold">
              {fmtValue(last.value, s.unit)}
            </text>
          );
        })()}
      </svg>
      {active && hover !== null && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-lg",
            // Anchor to the edge near the first/last point so the tooltip stays inside the card.
            hover === 0 ? "left-0" : hover === s.points.length - 1 ? "right-0" : "-translate-x-1/2",
          )}
          style={hover === 0 || hover === s.points.length - 1 ? undefined : { left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="font-semibold">{active.stage}% stage</p>
          <p className="text-muted-foreground">
            {active.value !== null ? fmtValue(active.value, s.unit) : "No reading"}
            {active.recordedAt && ` · ${fmtDay(active.recordedAt)}`}
          </p>
        </div>
      )}
    </div>
  );
}

export function MetricsDashboard({ series }: { series: MetricSeries[] }) {
  const [view, setView] = useState<"charts" | "table">("charts");
  const groups = [
    { kind: "failure" as const, title: "Failure metrics — gate every stage" },
    { kind: "success" as const, title: "Success metrics — tracked toward launch day" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-1" role="group" aria-label="Dashboard view">
        {(["charts", "table"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
            className={cn("rounded-md px-3 py-1 text-sm font-semibold", view === v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {v === "charts" ? "Charts" : "Table"}
          </button>
        ))}
      </div>
      {view === "table" ? (
        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-muted-foreground sm:hidden">Swipe sideways to see every stage.</p>
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Agreed metrics: latest reading per rollout stage, threshold and current status</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-semibold">Metric</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Threshold</th>
                {series[0].points.map((p) => <th key={p.stage} scope="col" className="py-2 pr-3 text-right font-semibold">{p.stage}%</th>)}
                <th scope="col" className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const st = STATE[s.state];
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-medium">{s.name}</th>
                    <td className="py-2 pr-3 text-muted-foreground">{thresholdText(s)}</td>
                    {s.points.map((p) => (
                      <td key={p.stage} className="py-2 pr-3 text-right tabular-nums">{p.value !== null ? fmtValue(p.value, s.unit) : "—"}</td>
                    ))}
                    <td className={cn("py-2", st.cls)}>
                      <span className="inline-flex items-center gap-1">
                        <st.Icon className="size-3.5" aria-hidden /> {st.label}
                        {s.stateStage !== null && <span className="text-muted-foreground"> at {s.stateStage}%</span>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        groups.map((g) => {
          const items = series.filter((s) => s.kind === g.kind);
          if (!items.length) return null;
          return (
            <div key={g.kind}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</h3>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((s) => {
                  const st = STATE[s.state];
                  return (
                    <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background/30 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="min-w-0 break-words text-sm font-semibold leading-snug">{s.name}</h4>
                        <span className={cn("inline-flex shrink-0 items-center gap-1 text-xs font-semibold", st.cls)}>
                          <st.Icon className="size-3.5" aria-hidden /> {st.label}
                          {s.stateStage !== null && <span className="font-normal text-muted-foreground">at {s.stateStage}%</span>}
                        </span>
                      </div>
                      <Chart s={s} />
                      <p className="text-xs text-muted-foreground">Owner: {s.owner}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
