// Pure edits on a LaunchDoc. Every function returns a new doc (never mutates) and bumps
// meta.updatedAt; judgment calls also append a dated line to the launch's decisions log.

import type {
  AnalysisKey,
  Decision,
  LaunchDoc,
  Metric,
  PhaseKey,
  Recipient,
  TeamKey,
  TeamSignoff,
} from "./types";

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

function touch(doc: LaunchDoc, now: Date): LaunchDoc {
  return { ...doc, meta: { ...doc.meta, updatedAt: now.toISOString() } };
}

export function logDecision(doc: LaunchDoc, text: string, now: Date, author = "PMM"): LaunchDoc {
  const d: Decision = { id: randomId("d"), date: now.toISOString(), text, author };
  return touch({ ...doc, decisions: [...doc.decisions, d] }, now);
}

export function editDecision(doc: LaunchDoc, id: string, text: string, now: Date): LaunchDoc {
  return touch({ ...doc, decisions: doc.decisions.map((d) => (d.id === id ? { ...d, text } : d)) }, now);
}

export function toggleChecklist(doc: LaunchDoc, id: string, now: Date): LaunchDoc {
  return touch({ ...doc, checklist: doc.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) }, now);
}

/** Editing an AI draft makes it the PMM's own text. */
export function setAnalysisField(doc: LaunchDoc, key: AnalysisKey, text: string, now: Date): LaunchDoc {
  const fields = { ...doc.analysis.fields, [key]: { text, source: "manual" as const, updatedAt: now.toISOString() } };
  return touch({ ...doc, analysis: { ...doc.analysis, fields } }, now);
}

export function setAlignmentText(doc: LaunchDoc, field: "problem" | "forWhom", text: string, now: Date): LaunchDoc {
  return touch({ ...doc, alignment: { ...doc.alignment, [field]: text } }, now);
}

export function upsertMetric(doc: LaunchDoc, metric: Omit<Metric, "id"> & { id?: string }, now: Date): LaunchDoc {
  const id = metric.id ?? randomId(metric.kind === "success" ? "s" : "f");
  const exists = doc.alignment.metrics.some((m) => m.id === id);
  const next: Metric = { ...metric, id };
  const metrics = exists ? doc.alignment.metrics.map((m) => (m.id === id ? next : m)) : [...doc.alignment.metrics, next];
  return touch({ ...doc, alignment: { ...doc.alignment, metrics } }, now);
}

export function removeMetric(doc: LaunchDoc, id: string, now: Date): LaunchDoc {
  return touch({ ...doc, alignment: { ...doc.alignment, metrics: doc.alignment.metrics.filter((m) => m.id !== id) } }, now);
}

export function setSignoff(doc: LaunchDoc, team: TeamKey, patch: Partial<TeamSignoff>, now: Date): LaunchDoc {
  const prev = doc.alignment.signoffs[team];
  const status = patch.status ?? prev.status;
  const signedAt = status === "signed" ? (prev.status === "signed" ? prev.signedAt : now.toISOString()) : null;
  const signoffs = { ...doc.alignment.signoffs, [team]: { ...prev, ...patch, status, signedAt } };
  return touch({ ...doc, alignment: { ...doc.alignment, signoffs } }, now);
}

/** Why alignment can't be locked yet; empty when it can. */
export function lockBlockers(doc: LaunchDoc): string[] {
  const a = doc.alignment;
  const out: string[] = [];
  if (!a.problem.trim()) out.push("Write the problem statement.");
  if (!a.metrics.some((m) => m.kind === "success")) out.push("Agree at least one success metric.");
  if (!a.metrics.some((m) => m.kind === "failure")) out.push("Agree at least one failure metric — rollout gates need it.");
  const unsigned = Object.values(a.signoffs).filter((s) => s.status !== "signed").length;
  if (unsigned) out.push(`${unsigned} team${unsigned === 1 ? " hasn't" : "s haven't"} signed off.`);
  return out;
}

export function lockAlignment(doc: LaunchDoc, now: Date): LaunchDoc {
  if (lockBlockers(doc).length) return doc;
  const locked = { ...doc, alignment: { ...doc.alignment, lockedAt: now.toISOString() } };
  const logged = logDecision(locked, "Alignment locked: problem, success and failure metrics signed off by all six teams.", now);
  // Locking is the alignment phase's gate, so it closes the phase too.
  return completePhase(logged, "alignment", now);
}

export function completePhase(doc: LaunchDoc, key: PhaseKey, now: Date): LaunchDoc {
  const phase = doc.phases.find((p) => p.key === key);
  if (!phase || phase.completedAt) return doc;
  const phases = doc.phases.map((p) => (p.key === key ? { ...p, completedAt: now.toISOString() } : p));
  const analysis = key === "analysis" ? { ...doc.analysis, completedAt: now.toISOString() } : doc.analysis;
  const late = now.getTime() > Date.parse(phase.eta);
  return logDecision({ ...doc, phases, analysis }, `${phase.name} closed${late ? " after its ETA" : ""}.`, now);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function addRecipient(doc: LaunchDoc, r: Recipient, now: Date): LaunchDoc {
  if (!EMAIL.test(r.email) || doc.rollout.recipients.some((x) => x.email.toLowerCase() === r.email.toLowerCase())) return doc;
  return touch({ ...doc, rollout: { ...doc.rollout, recipients: [...doc.rollout.recipients, r] } }, now);
}

export function removeRecipient(doc: LaunchDoc, email: string, now: Date): LaunchDoc {
  return touch({ ...doc, rollout: { ...doc.rollout, recipients: doc.rollout.recipients.filter((r) => r.email !== email) } }, now);
}

export const isEmail = (s: string) => EMAIL.test(s);
