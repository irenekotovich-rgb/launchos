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
