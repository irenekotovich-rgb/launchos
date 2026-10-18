// Stage-complete messages (PRD §5 "Notifications"): composed here, sent by the PMM's own mail client.
// v1 never sends email itself and stores no addresses server-side.

import { fmtDayYear, fmtValue } from "./format";
import { gateMoment, incrementOf, latestReading, metricState, stageGate } from "./launch-status";

/** Some mail clients truncate mailto: URLs around 2,000 characters; past this the UI offers Copy only. */
export const MAILTO_MAX_LENGTH = 1900;
import type { LaunchDoc, RolloutStage } from "./types";

export interface StageMessage {
  to: string[];
  subject: string;
  body: string;
}

export function composeStageMessage(doc: LaunchDoc, stage: RolloutStage, now: Date): StageMessage {
  const name = doc.brief.productName;
  const asOf = gateMoment(stage, now);
  const gate = stageGate(doc, stage, now);
  const full = stage.cumulative === 100;
  const next = doc.rollout.stages.find((s) => s.cumulative > stage.cumulative);

  const lines = doc.alignment.metrics.map((m) => {
    const r = latestReading(stage, m.id, asOf);
    const state = metricState(m, r?.value);
    const value = r ? fmtValue(r.value, m.unit) : "no reading";
    // Success metrics are tracked toward launch day, so "not met yet" is neutral, not a miss.
    const label = { met: "target met", "not-met": "tracking toward target", breached: "BREACHED", near: "near threshold", ok: "ok", "no-data": "no data" }[state];
    return `- ${m.name}: ${value} (${m.kind === "success" ? "target" : "fails at"} ${fmtValue(m.threshold, m.unit)}) — ${label}`;
  });

  const verdict = gate.overridden
    ? "Gate overridden with a logged decision."
    : gate.noFailureMetrics
      ? "No failure metrics were agreed, so this stage had no gate."
      : gate.passes
        ? "Gate passed: no failure metric breached, readings are current."
        : "Gate did NOT pass — see the metrics below.";

  const body = [
    "Hi all,",
    "",
    full
      ? `${name} is now rolled out to 100% of the audience.`
      : `The ${stage.cumulative}% stage of ${name} is complete (+${incrementOf(stage.cumulative)}% this stage).`,
    verdict,
    "",
    "Agreed metrics at this stage:",
    ...lines,
    "",
    full
      ? `Launch day: ${fmtDayYear(doc.brief.targetDate)}.`
      : next
        ? `Next: ${next.cumulative}% planned for ${fmtDayYear(next.plannedStart)}. Launch day (100%): ${fmtDayYear(doc.brief.targetDate)}.`
        : "",
    "",
    "Full status in the launch room.",
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");

  return {
    to: doc.rollout.recipients.map((r) => r.email),
    subject: full ? `${name}: rolled out to 100%` : `${name}: ${stage.cumulative}% rollout stage complete`,
    body,
  };
}

export function mailtoUrl(m: StageMessage): string {
  const q = `subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
  return `mailto:${m.to.map(encodeURIComponent).join(",")}?${q}`;
}
