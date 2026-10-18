// Request/response schemas for the generation API. Limits mirror the brief form (lib/brief.ts).
import { z } from "zod";
import { LIMITS } from "../brief";

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

export const analysisOutput = z.object({
  context: z.string(),
  environment: z.string(),
  competitors: z.string(),
  economics: z.string(),
  capacity: z.string(),
  audience: z.string(),
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

const ASSET_TYPE = z.enum(["release-notes", "blog-post", "announcement-email", "linkedin-post", "sales-one-pager", "faq"]);

/** Consistency check request: brief + messaging + the assets to check. */
export const consistencyRequest = z.object({
  brief: briefSchema.extend({ targetDate: z.iso.datetime() }), // past launch days are fine for a check
  messaging: messagingSchema,
  assets: z
    .array(z.object({ id: z.string().max(40), type: ASSET_TYPE, title: z.string().max(200), content: z.string().max(6000) }))
    .min(1)
    .max(6),
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
    )
    .max(40),
});

/** Regenerate one asset from the same brief + messaging block. */
export const assetRequest = z.object({
  brief: briefSchema.extend({ targetDate: z.iso.datetime() }),
  messaging: messagingSchema,
  type: ASSET_TYPE,
});
