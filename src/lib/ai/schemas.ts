// Request/response schemas for the generation API. Limits mirror the brief form (lib/brief.ts).
import { z } from "zod";
import { LIMITS } from "../brief";
import { ASSET_TYPES } from "../types";

export const briefSchema = z.object({
  productName: z.string().trim().min(1).max(LIMITS.productName),
  what: z.string().trim().min(1).max(LIMITS.what),
  who: z.string().trim().min(1).max(LIMITS.who),
  whyNow: z.string().trim().min(1).max(LIMITS.whyNow),
  targetDate: z.iso.datetime().refine((d) => Date.parse(d) > Date.now(), "Launch day must be in the future."),
  claims: z.array(z.string().trim().min(1).max(LIMITS.claim)).min(1).max(LIMITS.claims),
});

export const tierOutput = z.object({
  tier: z.enum(["T1", "T2", "T3"]),
  rationale: z.string().min(1),
  messaging: z.object({
    positioning: z.string().min(1),
    pillars: z.array(z.string().min(1)).min(1).max(5),
    proofPoints: z.array(z.string()).max(12),
    avoid: z.array(z.string()).max(12),
  }),
});

const highlight = z.object({
  value: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  visual: z.enum(["stat", "meter", "trend"]).optional(),
  level: z.number().min(0).max(100).optional(),
  trend: z.enum(["up", "flat", "down"]).optional(),
});
const analysisArea = z.object({
  summary: z.string(),
  highlights: z.array(highlight).min(1).max(3),
  points: z.array(z.string()).max(6),
});

export const analysisOutput = z.object({
  context: analysisArea,
  environment: analysisArea,
  competitors: analysisArea,
  economics: analysisArea,
  capacity: analysisArea,
  audience: analysisArea,
});

export const assetOutput = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export const messagingSchema = z.object({
  positioning: z.string().max(600),
  pillars: z.array(z.string().max(300)).max(6),
  proofPoints: z.array(z.string().max(300)).max(12),
  avoid: z.array(z.string().max(300)).max(12),
});

const ASSET_TYPE = z.enum(ASSET_TYPES);
/** Per-asset cap for the consistency check (the deck + demo script is the longest). */
export const MAX_ASSET_CHARS = 9000;

/** Consistency check request: brief + messaging + the assets to check. */
export const consistencyRequest = z.object({
  brief: briefSchema.extend({ targetDate: z.iso.datetime() }), // past launch days are fine for a check
  messaging: messagingSchema,
  assets: z
    .array(z.object({ id: z.string().max(40), type: ASSET_TYPE, title: z.string().max(200), content: z.string().max(MAX_ASSET_CHARS) }))
    .min(1)
    .max(ASSET_TYPES.length),
});

export const consistencyOutput = z.object({
  findings: z
    .array(
      z.object({
        assetId: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        category: z.enum(["claim", "number", "feature", "tone"]),
        excerpt: z.string(),
        briefReference: z.string(),
        suggestion: z.string(),
      }),
    ),
  // No .max() here: Gemini lite models reject maxItems on this array ("invalid argument");
  // the 40-finding cap is applied in code (lib/ai/consistency.ts).
});

/** Regenerate one asset from the same brief + messaging block. */
export const assetRequest = z.object({
  brief: briefSchema.extend({ targetDate: z.iso.datetime() }),
  messaging: messagingSchema,
  type: ASSET_TYPE,
  /** Agreed metric names, so the campaign plan maps channels to real metrics instead of inventing them. */
  metrics: z.array(z.string().max(200)).max(5).optional(),
});
