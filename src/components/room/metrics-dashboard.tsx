"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, OctagonAlert, TrendingUp } from "lucide-react";
import { fmtDay, fmtValue } from "@/lib/format";
import type { MetricState } from "@/lib/launch-status";
import type { Metric } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface MetricSeries {
  id: string;
  name: string;
  kind: Metric["kind"];
  unit: string;
  direction: Metric["direction"];
  threshold: number;
  owner: string;
  points: { stage: number; value: number | null; recordedAt: string | null }[];
  state: MetricState;
  lastStage: number | null;
}

// Status always ships with an icon + label, never colour alone (dataviz rule).
const STATE: Record<MetricState, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  met: { label: "Target met", cls: "text-success", Icon: CheckCircle2 },
  "not-met": { label: "Below target", cls: "text-muted-foreground", Icon: TrendingUp },
  ok: { label: "Healthy", cls: "text-success", Icon: CheckCircle2 },
  near: { label: "Near threshold", cls: "text-warning", Icon: AlertTriangle },
  breached: { label: "Breached", cls: "text-destructive", Icon: OctagonAlert },
  "no-data": { label: "No data", cls: "text-muted-foreground", Icon: CircleDashed },
};

const W = 280;
const H = 132;
const PAD = { top: 14, right: 12, bottom: 24, left: 12 };

function Chart({ s }: { s: MetricSeries }) {
  const [hover, setHover] = useState<number | null>(null);
  const values = s.points.flatMap((p) => (p.value === null ? [] : [p.value]));
  const max = Math.max(s.threshold, ...values) * 1.15;
  const min = Math.min(0, ...values);
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (s.points.length - 1);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min || 1)) * (H - PAD.top - PAD.bottom);
  const drawn = s.points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as { stage: number; value: number; recordedAt: string; i: number }[];
  const path = drawn.map((p, k) => `${k ? "L" : "M"}${x(p.i)},${y(p.value)}`).join(" ");
  const ty = y(s.threshold);
  const thresholdLabel = `${s.kind === "success" ? "target" : "fails at"} ${fmtValue(s.threshold, s.unit)}`;
  const active = hover !== null ? s.points[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img"
        aria-label={`${s.name}: ${drawn.map((p) => `${p.stage}% stage ${fmtValue(p.value, s.unit)}`).join(", ") || "no readings"}; ${thresholdLabel}`}>
        {/* baseline + threshold reference (hairline, solid, recessive) */}
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} className="stroke-border" strokeWidth={1} />
        <line x1={PAD.left} x2={W - PAD.right} y1={ty} y2={ty} stroke="var(--muted-foreground)" strokeOpacity={0.6} strokeWidth={1} />
        <text x={W - PAD.right} y={ty - 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{thresholdLabel}</text>
        {path && <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {s.points.map((p, i) => (
          <g key={p.stage}>
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{p.stage}%</text>
            {p.value !== null && (
              <circle cx={x(i)} cy={y(p.value)} r={4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
            )}
            {/* hit target larger than the mark */}
            <rect x={x(i) - 22} y={0} width={44} height={H} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={p.value !== null ? 0 : -1}
              aria-label={`${p.stage}% stage: ${p.value !== null ? fmtValue(p.value, s.unit) : "no reading"}`} />
          </g>
        ))}
        {/* direct label on the latest point only */}
        {drawn.length > 0 && hover === null && (
          <text x={x(drawn.at(-1)!.i)} y={y(drawn.at(-1)!.value) - 10} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
            {fmtValue(drawn.at(-1)!.value, s.unit)}
          </text>
        )}
      </svg>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
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
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Metric</th>
                <th className="py-2 pr-3 font-semibold">Threshold</th>
                {series[0].points.map((p) => <th key={p.stage} className="py-2 pr-3 text-right font-semibold">{p.stage}%</th>)}
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const st = STATE[s.state];
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{s.direction === "above" ? "≥" : "≤"} {fmtValue(s.threshold, s.unit)}</td>
                    {s.points.map((p) => (
                      <td key={p.stage} className="py-2 pr-3 text-right tabular-nums">{p.value !== null ? fmtValue(p.value, s.unit) : "—"}</td>
                    ))}
                    <td className={cn("py-2", st.cls)}>{st.label}</td>
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
