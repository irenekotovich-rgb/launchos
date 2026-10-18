// Pure edits on a LaunchDoc. Every function returns a new doc (never mutates) and bumps
// meta.updatedAt; judgment calls also append a dated line to the launch's decisions log.

import type {
  AnalysisKey,
  Asset,
  AssetType,
  ConsistencyFinding,
  Decision,
  Highlight,
  LaunchBrief,
  ModelRun,
  LaunchDoc,
  Metric,
  PhaseKey,
  Recipient,
  TeamKey,
  TeamSignoff,
} from "./types";
import { isLaunchDoc, sanitizeLaunchDoc } from "./validate";

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

// ---------------------------------------------------------------- brief, consistency, assets

const BRIEF_LABEL: Record<keyof LaunchBrief, string> = {
  productName: "name",
  what: "what ships",
  who: "who it's for",
  whyNow: "why now",
  targetDate: "launch day",
  claims: "claims",
};

/**
 * Editing the brief flags every generated asset stale (drift control is the product) and clears
 * findings, which were judged against the old brief. Re-run the check or regenerate to clear.
 */
export function editBrief(doc: LaunchDoc, patch: Partial<LaunchBrief>, now: Date): LaunchDoc {
  const changed = (Object.keys(patch) as (keyof LaunchBrief)[]).filter(
    (k) => JSON.stringify(patch[k]) !== JSON.stringify(doc.brief[k]),
  );
  if (!changed.length) return doc;
  const assets = doc.assets.map((a) => (a.content ? { ...a, status: "stale" as const } : a));
  const flagged = assets.filter((a) => a.status === "stale").length;
  // The messaging block was derived from the old brief; mark it so checks and regeneration use the brief.
  const messaging = doc.messaging ? { ...doc.messaging, stale: true } : undefined;
  const next = { ...doc, brief: { ...doc.brief, ...patch }, assets, findings: [], messaging };
  return logDecision(
    next,
    `Brief edited (${changed.map((k) => BRIEF_LABEL[k]).join(", ")})${flagged ? `; ${flagged} asset${flagged === 1 ? "" : "s"} flagged stale` : ""}.`,
    now,
  );
}

/** Findings replace the previous run; assets with high/medium findings drift, the rest are on brief. */
export function applyConsistency(doc: LaunchDoc, findings: ConsistencyFinding[], model: ModelRun, now: Date): LaunchDoc {
  const serious = new Set(findings.filter((f) => f.severity !== "low").map((f) => f.assetId));
  const assets = doc.assets.map((a) =>
    a.content && a.status !== "generating" ? { ...a, status: serious.has(a.id) ? ("stale" as const) : ("ok" as const) } : a,
  );
  const next = { ...doc, findings, assets, meta: { ...doc.meta, models: [...doc.meta.models, model] } };
  return logDecision(
    next,
    findings.length
      ? `Consistency check: ${findings.length} finding${findings.length === 1 ? "" : "s"}, ${serious.size} asset${serious.size === 1 ? "" : "s"} drifted from the brief.`
      : "Consistency check: every asset matches the brief.",
    now,
    "LaunchOS",
  );
}

/** A regenerated asset replaces the old one by type, starts as a draft and drops its old findings. */
export function replaceAsset(
  doc: LaunchDoc,
  generated: { type: AssetType; title: string; content: string; modelId: string },
  model: ModelRun,
  now: Date,
): LaunchDoc {
  // Match by type, not id: imported docs may carry different ids.
  const existing = doc.assets.find((a) => a.type === generated.type);
  const id = existing?.id ?? `a-${generated.type}`;
  const asset: Asset = { id, type: generated.type, title: generated.title, content: generated.content, status: "draft", generatedAt: now.toISOString(), modelId: generated.modelId };
  const exists = Boolean(existing);
  const assets = exists ? doc.assets.map((a) => (a.id === id ? asset : a)) : [...doc.assets, asset];
  const next = { ...doc, assets, findings: doc.findings.filter((f) => f.assetId !== id), meta: { ...doc.meta, models: [...doc.meta.models, model] } };
  return logDecision(next, `${generated.title} ${exists ? "regenerated" : "generated"} from the current brief.`, now, "LaunchOS");
}

export function setShareInfo(doc: LaunchDoc, share: LaunchDoc["meta"]["share"] | null, now: Date): LaunchDoc {
  const { share: _old, ...meta } = doc.meta;
  void _old;
  return touch({ ...doc, meta: share ? { ...meta, share } : meta }, now);
}

/**
 * An imported file becomes a fresh launch in this browser: new id, no share secrets, export-only
 * fields dropped. A demo export stays labelled demo (fictional content is never relabelled as own).
 */
export function prepareImport(raw: unknown, newId: string, now: Date): LaunchDoc | null {
  if (!isLaunchDoc(raw)) return null;
  const { author: _a, exportedAt: _e, ...doc } = raw as LaunchDoc & { author?: unknown; exportedAt?: unknown };
  void _a;
  void _e;
  const { share: _s, sharedAt: _sa, ...meta } = doc.meta;
  void _s;
  void _sa;
  const imported: LaunchDoc = { ...doc, meta: { ...meta, id: newId, mode: meta.mode === "demo" ? "demo" : "own", updatedAt: now.toISOString() } };
  return logDecision(sanitizeLaunchDoc(imported), "Launch imported from a JSON file.", now, "LaunchOS");
}

/** Edits to the analysis facts or bullets make the field the PMM's own (drops the AI-draft label). */
export function setAnalysisDetail(
  doc: LaunchDoc,
  key: AnalysisKey,
  patch: { highlights?: Highlight[]; points?: string[] },
  now: Date,
): LaunchDoc {
  const prev = doc.analysis.fields[key];
  const highlights = patch.highlights?.filter((h) => h.value.trim() && h.label.trim()).slice(0, 3);
  const points = patch.points?.map((p) => p.trim()).filter(Boolean).slice(0, 8);
  const next = {
    ...prev,
    ...(highlights ? { highlights } : {}),
    ...(points ? { points } : {}),
    source: "manual" as const,
    updatedAt: now.toISOString(),
  };
  if (JSON.stringify(next.highlights) === JSON.stringify(prev.highlights) && JSON.stringify(next.points) === JSON.stringify(prev.points)) return doc;
  return touch({ ...doc, analysis: { ...doc.analysis, fields: { ...doc.analysis.fields, [key]: next } } }, now);
}
