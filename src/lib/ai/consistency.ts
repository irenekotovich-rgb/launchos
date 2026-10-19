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

export async function checkConsistency(
  req: z.infer<typeof consistencyRequest>,
  now = new Date(),
): Promise<{ findings: ConsistencyFinding[]; model: ModelRun }> {
  const prompt = await loadPrompt("consistency-rubric");
  const assets = req.assets
    .map((a) => `<asset id="${a.id}" type="${a.type}" title="${a.title.replace(/"/g, "'")}">\n${neutralise(a.content)}\n</asset>`)
    .join("\n\n");
  const text = render(prompt.body, { brief: briefAsText(req.brief), messaging: messagingAsText(req.messaging), assets });
  const contentById = new Map(req.assets.map((a) => [a.id, squash(a.content)]));
  const r = await generateStructured(consistencyOutput, text, modelChain(), Date.now() + 100_000);
  const ids = new Set(req.assets.map((a) => a.id));
  const findings = r.object.findings
    .slice(0, 40)
    .filter((f) => ids.has(f.assetId)) // drop hallucinated asset ids
    // Drop findings whose "verbatim" excerpt isn't actually in the asset — a deterministic guard
    // against hallucinated findings.
    .filter((f) => contentById.get(f.assetId)!.includes(squash(normalizeText(f.excerpt)).replace(/^["“]|["”]$/g, "")))
    .map((f, i) => ({
      id: `cf-${i + 1}`,
      assetId: f.assetId,
      severity: f.severity,
      category: f.category,
      excerpt: normalizeText(f.excerpt).slice(0, 300),
      briefReference: normalizeText(f.briefReference).slice(0, 300),
      suggestion: normalizeText(f.suggestion).slice(0, 500),
    }));
  return {
    findings,
    model: { step: "consistency", modelId: r.modelId, ranAt: now.toISOString(), prompt: prompt.name, promptVersion: prompt.version },
  };
}
