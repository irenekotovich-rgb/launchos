// Consistency check (PRD §5): every asset compared to the brief + messaging block on the fixed
// rubric in prompts/consistency-rubric.md. One call for the whole kit keeps it cheap and comparable.
import "server-only";
import type { z } from "zod";
import { briefAsText, messagingAsText, normalizeText } from "./generate";
import { generateStructured, modelChain } from "./models";
import { loadPrompt, render } from "./prompts";
import { consistencyOutput, type consistencyRequest } from "./schemas";
import type { ConsistencyFinding, ModelRun } from "../types";

/** Content can't close the data fence it's wrapped in. */
export const neutralise = (s: string) => s.replace(/<\/(asset|brief)/gi, "</ $1");
/** Case- and whitespace-insensitive comparison form for excerpt matching. */
export const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const MAX_FINDINGS = 40;

/**
 * Drops findings for unknown assets or with non-verbatim excerpts, THEN caps at MAX_FINDINGS
 * (so hallucinated findings can't push valid ones out). The cap is enforced here because Gemini
 * lite models reject maxItems in the response schema.
 */
export function finalizeFindings(
  raw: z.infer<typeof consistencyOutput>["findings"],
  assets: { id: string; content: string }[],
): ConsistencyFinding[] {
  const contentById = new Map(assets.map((a) => [a.id, squash(a.content)]));
  const valid = raw.filter(
    (f) => contentById.has(f.assetId) && contentById.get(f.assetId)!.includes(squash(normalizeText(f.excerpt)).replace(/^["“]|["”]$/g, "")),
  );
  if (valid.length > MAX_FINDINGS) console.warn(`[consistency] ${valid.length} findings, truncated to ${MAX_FINDINGS}`);
  return valid.slice(0, MAX_FINDINGS).map((f, i) => ({
    id: `cf-${i + 1}`,
    assetId: f.assetId,
    severity: f.severity,
    category: f.category,
    excerpt: normalizeText(f.excerpt).slice(0, 300),
    briefReference: normalizeText(f.briefReference).slice(0, 300),
    suggestion: normalizeText(f.suggestion).slice(0, 500),
  }));
}

export async function checkConsistency(
  req: z.infer<typeof consistencyRequest>,
  now = new Date(),
): Promise<{ findings: ConsistencyFinding[]; model: ModelRun }> {
  const prompt = await loadPrompt("consistency-rubric");
  const assets = req.assets
    .map((a) => `<asset id="${a.id}" type="${a.type}" title="${a.title.replace(/"/g, "'")}">\n${neutralise(a.content)}\n</asset>`)
    .join("\n\n");
  const text = render(prompt.body, { brief: briefAsText(req.brief), messaging: messagingAsText(req.messaging), assets });
  const r = await generateStructured(consistencyOutput, text, modelChain(), Date.now() + 100_000);
  const findings = finalizeFindings(r.object.findings, req.assets);
  return {
    findings,
    model: { step: "consistency", modelId: r.modelId, ranAt: now.toISOString(), prompt: prompt.name, promptVersion: prompt.version },
  };
}
