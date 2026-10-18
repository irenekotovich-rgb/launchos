// LaunchDoc: one launch = one portable JSON document (docs/PRD.md §5 "Data model").
// Everything the launch room renders is derived from this shape; nothing lives elsewhere.

export const LAUNCH_DOC_SCHEMA_VERSION = 1;

/** ISO 8601 date-time string, e.g. "2026-10-18T09:00:00.000Z". */
export type IsoDate = string;

export type LaunchMode = "demo" | "own";

export interface LaunchDoc {
  schemaVersion: typeof LAUNCH_DOC_SCHEMA_VERSION;
  meta: LaunchMeta;
  brief: LaunchBrief;
  analysis: Analysis;
  alignment: Alignment;
  tier: TierDecision;
  phases: Phase[];
  checklist: ChecklistItem[];
  rollout: Rollout;
  assets: Asset[];
  findings: ConsistencyFinding[];
  decisions: Decision[];
  /** Messaging block every asset was generated from (absent until generation ran). */
  messaging?: Messaging;
}

export interface Messaging {
  positioning: string;
  pillars: string[];
  proofPoints: string[];
  avoid: string[];
  /** Set when the brief was edited after this block was generated: the brief wins until it's refreshed. */
  stale?: boolean;
}

// ---------------------------------------------------------------- meta

export interface LaunchMeta {
  id: string;
  /** "demo" content is fictional and labeled on every screen. */
  mode: LaunchMode;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  author: { name: string; url: string };
  /** Every model call that produced content in this doc (honesty rule). */
  models: ModelRun[];
  /** Present while a read-only share link exists. The delete token never leaves the owner's device. */
  share?: { id: string; deleteToken: string; createdAt: IsoDate };
  /** Set on shared snapshots: when the snapshot was taken. */
  sharedAt?: IsoDate;
  /** Outcome of the AI generation step; absent for the demo and pre-M2 docs. */
  generation?: {
    status: "live" | "unavailable" | "budget-exhausted";
    note: string;
  };
}

export interface ModelRun {
  step: "analysis" | "tier" | "assets" | "consistency";
  modelId: string;
  ranAt: IsoDate;
  /** prompts/<name>.md and its frontmatter version. */
  prompt?: string;
  promptVersion?: number;
}

// ---------------------------------------------------------------- brief

export interface LaunchBrief {
  productName: string;
  /** What ships. */
  what: string;
  /** For whom. */
  who: string;
  whyNow: string;
  /** Launch day = 100% rollout (general availability). The countdown targets it. */
  targetDate: IsoDate;
  claims: string[];
}

// ---------------------------------------------------------------- stage 1: analysis

export type AnalysisKey =
  | "context"
  | "environment"
  | "competitors"
  | "economics"
  | "capacity"
  | "audience";

export interface AnalysisField {
  text: string;
  /** "ai-draft" fields render with "draft — review before publishing". */
  source: "manual" | "ai-draft";
  updatedAt: IsoDate | null;
}

export interface Analysis {
  fields: Record<AnalysisKey, AnalysisField>;
  completedAt: IsoDate | null;
}

// ---------------------------------------------------------------- stage 2: alignment

export type TeamKey = "stakeholders" | "rnd" | "marketing" | "sales" | "support" | "legal";

export type MetricKind = "success" | "failure";

export interface Metric {
  id: string;
  kind: MetricKind;
  name: string;
  unit: string;
  /**
   * Which side of the threshold "crosses" it (inclusive): "above" = value >= threshold,
   * "below" = value <= threshold. Crossing means success for success metrics and a breach
   * for failure metrics.
   */
  direction: "above" | "below";
  threshold: number;
  owner: string;
}

export interface TeamSignoff {
  lead: string;
  status: "pending" | "signed" | "objected";
  note: string;
  signedAt: IsoDate | null;
}

export interface Alignment {
  problem: string;
  forWhom: string;
  metrics: Metric[];
  /** Keyed by team so a team can't be missing or duplicated. */
  signoffs: Record<TeamKey, TeamSignoff>;
  lockedAt: IsoDate | null;
}

// ---------------------------------------------------------------- plan

export type Tier = "T1" | "T2" | "T3";

export interface TierDecision {
  tier: Tier;
  rationale: string;
  /** Decision id when the PMM overrode the suggested tier. */
  overrideDecisionId: string | null;
}

export type PhaseKey = "analysis" | "alignment" | "brief" | "assets" | "readiness" | "rollout";

export interface Phase {
  key: PhaseKey;
  name: string;
  start: IsoDate;
  /** Planned end — the phase ETA. */
  eta: IsoDate;
  completedAt: IsoDate | null;
  /** Exit criterion in one line. */
  gate: string;
}

export interface ChecklistItem {
  id: string;
  phase: PhaseKey;
  label: string;
  owner: string;
  done: boolean;
  note: string;
}

// ---------------------------------------------------------------- staged rollout

/** Fixed increments per PRD: 10 → +20 → +30 → +40 (cumulative 10/30/60/100%). */
export const ROLLOUT_STEPS = [
  { increment: 10, cumulative: 10 },
  { increment: 20, cumulative: 30 },
  { increment: 30, cumulative: 60 },
  { increment: 40, cumulative: 100 },
] as const;

export type RolloutStatus = "not-started" | "live" | "complete" | "halted";

export interface MetricReading {
  metricId: string;
  value: number;
  recordedAt: IsoDate;
}

export type RolloutPercent = (typeof ROLLOUT_STEPS)[number]["cumulative"];

/** The increment is derived from `cumulative` via ROLLOUT_STEPS, never stored. */
export interface RolloutStage {
  cumulative: RolloutPercent;
  status: RolloutStatus;
  plannedStart: IsoDate;
  startedAt: IsoDate | null;
  completedAt: IsoDate | null;
  readings: MetricReading[];
  /** Set when the stage-complete message was opened for sending. */
  notifiedAt: IsoDate | null;
  /** Decision id when the gate was overridden instead of passed. */
  overrideDecisionId: string | null;
}

export interface Recipient {
  name: string;
  role: string;
  email: string;
  group: "stakeholder" | "team-lead";
}

export interface Rollout {
  /** Always four stages in ROLLOUT_STEPS order. */
  stages: [RolloutStage, RolloutStage, RolloutStage, RolloutStage];
  recipients: Recipient[];
}

// ---------------------------------------------------------------- assets & consistency

export type AssetType =
  | "release-notes"
  | "blog-post"
  | "announcement-email"
  | "linkedin-post"
  | "sales-one-pager"
  | "faq";

export type AssetStatus = "generating" | "draft" | "stale" | "ok";

export interface Asset {
  id: string;
  type: AssetType;
  title: string;
  status: AssetStatus;
  content: string;
  generatedAt: IsoDate | null;
  modelId: string | null;
}

export interface ConsistencyFinding {
  id: string;
  assetId: string;
  severity: "high" | "medium" | "low";
  category: "claim" | "number" | "feature" | "tone";
  excerpt: string;
  briefReference: string;
  suggestion: string;
}

// ---------------------------------------------------------------- decisions

export interface Decision {
  id: string;
  date: IsoDate;
  text: string;
  author: string;
  /** Set when the PMM edited the entry after logging it. */
  editedAt?: IsoDate;
}
