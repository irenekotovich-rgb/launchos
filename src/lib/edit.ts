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

const randomId = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
const frozen = (doc: LaunchDoc) => doc.alignment.lockedAt !== null;

function touch(doc: LaunchDoc, now: Date): LaunchDoc {
  return { ...doc, meta: { ...doc.meta, updatedAt: now.toISOString() } };
}

export function logDecision(doc: LaunchDoc, text: string, now: Date, author = "PMM"): LaunchDoc {
  const d: Decision = { id: randomId("d"), date: now.toISOString(), text, author };
  return touch({ ...doc, decisions: [...doc.decisions, d] }, now);
}

/** Only the PMM's own entries are editable; edits are marked so the log stays honest. */
export function editDecision(doc: LaunchDoc, id: string, text: string, now: Date): LaunchDoc {
  const target = doc.decisions.find((d) => d.id === id);
  const clean = text.trim();
  if (!target || target.author !== "PMM" || !clean || clean === target.text) return doc;
  return touch(
    { ...doc, decisions: doc.decisions.map((d) => (d.id === id ? { ...d, text: clean, editedAt: now.toISOString() } : d)) },
    now,
  );
}

export function toggleChecklist(doc: LaunchDoc, id: string, now: Date): LaunchDoc {
  if (!doc.checklist.some((c) => c.id === id)) return doc;
  return touch({ ...doc, checklist: doc.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) }, now);
}

/** Editing an AI draft makes it the PMM's own text; saving it unchanged keeps the draft label. */
export function setAnalysisField(doc: LaunchDoc, key: AnalysisKey, text: string, now: Date): LaunchDoc {
  if (doc.analysis.fields[key].text === text) return doc;
  const fields = { ...doc.analysis.fields, [key]: { text, source: "manual" as const, updatedAt: now.toISOString() } };
  return touch({ ...doc, analysis: { ...doc.analysis, fields } }, now);
}

// Alignment edits are refused once alignment is locked (the freeze is a model rule, not just UI).
export function setAlignmentText(doc: LaunchDoc, field: "problem" | "forWhom", text: string, now: Date): LaunchDoc {
  if (frozen(doc) || doc.alignment[field] === text) return doc;
  return touch({ ...doc, alignment: { ...doc.alignment, [field]: text } }, now);
}

export function upsertMetric(doc: LaunchDoc, metric: Omit<Metric, "id"> & { id?: string }, now: Date): LaunchDoc {
  if (frozen(doc)) return doc;
  const id = metric.id ?? randomId(metric.kind === "success" ? "s" : "f");
  const exists = doc.alignment.metrics.some((m) => m.id === id);
  const next: Metric = { ...metric, id };
  const metrics = exists ? doc.alignment.metrics.map((m) => (m.id === id ? next : m)) : [...doc.alignment.metrics, next];
  return touch({ ...doc, alignment: { ...doc.alignment, metrics } }, now);
}

export function removeMetric(doc: LaunchDoc, id: string, now: Date): LaunchDoc {
  if (frozen(doc) || !doc.alignment.metrics.some((m) => m.id === id)) return doc;
  return touch({ ...doc, alignment: { ...doc.alignment, metrics: doc.alignment.metrics.filter((m) => m.id !== id) } }, now);
}

export function setSignoff(doc: LaunchDoc, team: TeamKey, patch: Partial<TeamSignoff>, now: Date): LaunchDoc {
  if (frozen(doc)) return doc;
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
  if (unsigned) out.push(`${unsigned} team${unsigned === 1 ? " hasn't" : "s haven't"} signed off (pending or objected).`);
  return out;
}

export function lockAlignment(doc: LaunchDoc, now: Date): LaunchDoc {
  if (frozen(doc) || lockBlockers(doc).length) return doc;
  const locked = { ...doc, alignment: { ...doc.alignment, lockedAt: now.toISOString() } };
  const logged = logDecision(locked, "Alignment locked: problem, success and failure metrics signed off by all six teams.", now);
  // Locking is the alignment phase's gate, so it closes the phase too.
  return completePhase(logged, "alignment", now);
}

/** Any open phase can be closed (phases may overlap); the UI offers it for the current one. */
export function completePhase(doc: LaunchDoc, key: PhaseKey, now: Date): LaunchDoc {
  const phase = doc.phases.find((p) => p.key === key);
  if (!phase || phase.completedAt) return doc;
  const phases = doc.phases.map((p) => (p.key === key ? { ...p, completedAt: now.toISOString() } : p));
  const analysis = key === "analysis" ? { ...doc.analysis, completedAt: now.toISOString() } : doc.analysis;
  const late = now.getTime() > Date.parse(phase.eta);
  return logDecision({ ...doc, phases, analysis }, `${phase.name} closed${late ? " after its ETA" : ""}.`, now);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecipientCheck = "ok" | "invalid-email" | "duplicate";

export function checkRecipient(doc: LaunchDoc, email: string): RecipientCheck {
  const e = email.trim().toLowerCase();
  if (!EMAIL.test(e)) return "invalid-email";
  return doc.rollout.recipients.some((x) => x.email === e) ? "duplicate" : "ok";
}

/** Emails are stored lower-cased so add and remove compare the same way. */
export function addRecipient(doc: LaunchDoc, r: Recipient, now: Date): LaunchDoc {
  if (checkRecipient(doc, r.email) !== "ok") return doc;
  const recipient = { ...r, email: r.email.trim().toLowerCase() };
  return touch({ ...doc, rollout: { ...doc.rollout, recipients: [...doc.rollout.recipients, recipient] } }, now);
}

export function removeRecipient(doc: LaunchDoc, email: string, now: Date): LaunchDoc {
  return touch({ ...doc, rollout: { ...doc.rollout, recipients: doc.rollout.recipients.filter((r) => r.email !== email) } }, now);
}

export const isEmail = (s: string) => EMAIL.test(s);
