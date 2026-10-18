// Server-side generation: brief → tier + messaging block → analysis drafts → six assets.
// Every asset is generated from the same brief + messaging block (PRD §5 "Generation").
import "server-only";
import type { z } from "zod";
import { GenerationUnavailable, generateStructured, modelChain } from "./models";
import { loadPrompt, render } from "./prompts";
import { analysisOutput, assetOutput, tierOutput, type briefSchema } from "./schemas";
import type { AssetType, LaunchBrief, Messaging, ModelRun, Tier } from "../types";

export const ASSET_TYPES: AssetType[] = [
  "release-notes",
  "blog-post",
  "announcement-email",
  "linkedin-post",
  "sales-one-pager",
  "faq",
];

export interface GeneratedContent {
  tier: { tier: Tier; rationale: string };
  messaging: Messaging;
  analysis: z.infer<typeof analysisOutput> | null;
  assets: { type: AssetType; title: string; content: string; modelId: string }[];
  models: ModelRun[];
  /** Asset types that failed on every model; the rest of the kit still ships. */
  failedAssets: AssetType[];
}

/** The brief is user input: fenced so prompts can tell the model to treat it as data only. */
export function briefAsText(b: LaunchBrief): string {
  const n = (s: string) => s.replace(/<\/(asset|brief)/gi, "</ $1");
  b = { ...b, productName: n(b.productName), what: n(b.what), who: n(b.who), whyNow: n(b.whyNow), claims: b.claims.map(n) };
  return [
    "<brief>",
    `Product / feature: ${b.productName}`,
    `What ships: ${b.what}`,
    `Who it's for: ${b.who}`,
    `Why now: ${b.whyNow}`,
    `Launch day (100% rollout): ${b.targetDate.slice(0, 10)}`,
    `Key claims:`,
    ...b.claims.map((c) => `- ${c}`),
    "</brief>",
  ].join("\n");
}

export function messagingAsText(m: Messaging): string {
  return [
    `Positioning: ${m.positioning}`,
    `Pillars:`,
    ...m.pillars.map((p) => `- ${p}`),
    `Proof points (only these facts may be cited):`,
    ...(m.proofPoints.length ? m.proofPoints.map((p) => `- ${p}`) : ["- (none beyond the brief)"]),
    `Avoid:`,
    ...(m.avoid.length ? m.avoid.map((a) => `- ${a}`) : ["- (nothing specific)"]),
  ].join("\n");
}

/**
 * Some models double-escape newlines inside JSON strings, so text arrives with literal "\n".
 * Turn those back into real line breaks and trim trailing spaces per line.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\\t/g, " ")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

/** Small concurrency limit: free tiers rate-limit bursts. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** One asset from the brief + messaging block (used by the full run and by "regenerate"). */
export async function generateAsset(
  brief: LaunchBrief,
  messaging: Messaging,
  type: AssetType,
  deadline = Date.now() + 100_000,
  ranAt = new Date().toISOString(),
): Promise<{ asset: GeneratedContent["assets"][number]; model: ModelRun }> {
  const prompt = await loadPrompt(`asset-${type}`);
  const r = await generateStructured(
    assetOutput,
    render(prompt.body, { brief: briefAsText(brief), messaging: messagingAsText(messaging) }),
    modelChain(),
    deadline,
  );
  return {
    asset: { type, title: normalizeText(r.object.title), content: normalizeText(r.object.content), modelId: r.modelId },
    model: { step: "assets", modelId: r.modelId, ranAt, prompt: prompt.name, promptVersion: prompt.version },
  };
}

/**
 * Throws GenerationUnavailable only if the tier/messaging step fails on every model —
 * without a messaging block no asset can be generated consistently. Later steps degrade
 * per item (analysis → null, an asset → listed in failedAssets).
 */
export async function generateLaunchContent(brief: z.infer<typeof briefSchema>, now = new Date()): Promise<GeneratedContent> {
  const chain = modelChain();
  if (!chain.length) throw new GenerationUnavailable([]);
  const ranAt = now.toISOString();
  // Whole request must finish under the route's maxDuration (120s) with room to respond.
  const deadline = Date.now() + 105_000;
  const briefText = briefAsText(brief);
  const models: ModelRun[] = [];

  const tierPrompt = await loadPrompt("brief-to-tier");
  const tier = await generateStructured(tierOutput, render(tierPrompt.body, { brief: briefText }), chain, deadline);
  models.push({ step: "tier", modelId: tier.modelId, ranAt, prompt: tierPrompt.name, promptVersion: tierPrompt.version });
  const messaging = tier.object.messaging;

  const analysisPrompt = await loadPrompt("analysis-draft");
  const analysisTask = generateStructured(analysisOutput, render(analysisPrompt.body, { brief: briefText }), chain, deadline)
    .then((r) => {
      models.push({ step: "analysis", modelId: r.modelId, ranAt, prompt: analysisPrompt.name, promptVersion: analysisPrompt.version });
      return Object.fromEntries(Object.entries(r.object).map(([k, v]) => [k, normalizeText(v)])) as typeof r.object;
    })
    .catch(() => null);

  const failedAssets: AssetType[] = [];
  const assetsTask = mapLimit(ASSET_TYPES, 2, async (type) => {
    try {
      const r = await generateAsset(brief, messaging, type, deadline, ranAt);
      models.push(r.model);
      return r.asset;
    } catch (err) {
      console.warn(`[generate] asset ${type} failed on every model`, err instanceof GenerationUnavailable ? err.attempts : err);
      failedAssets.push(type);
      return null;
    }
  });

  const [analysis, assets] = await Promise.all([analysisTask, assetsTask]);
  const STEP_ORDER = ["tier", "analysis", "assets", "consistency"];
  models.sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step));
  return {
    tier: { tier: tier.object.tier, rationale: normalizeText(tier.object.rationale) },
    messaging,
    analysis,
    assets: assets.filter((a): a is NonNullable<typeof a> => a !== null),
    models,
    failedAssets,
  };
}
