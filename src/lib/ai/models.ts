// Ordered fallback chain (PRD §5): primary (Gemini) → cheap fallbacks (OpenRouter) → unavailable.
// Model ids are env-overridable so a fork can pick its own without code changes.
import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output, type LanguageModel } from "ai";
import type { z } from "zod";

export const DEFAULT_PRIMARY = "gemini-3.5-flash";
export const DEFAULT_FALLBACKS = ["nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free"];

interface Candidate {
  id: string;
  model: LanguageModel;
}

export function modelChain(env: NodeJS.ProcessEnv = process.env): Candidate[] {
  const chain: Candidate[] = [];
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    const id = env.LAUNCHOS_PRIMARY_MODEL || DEFAULT_PRIMARY;
    chain.push({ id, model: google(id) });
  }
  if (env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    const ids = env.LAUNCHOS_FALLBACK_MODELS ? env.LAUNCHOS_FALLBACK_MODELS.split(",").map((s) => s.trim()) : DEFAULT_FALLBACKS;
    for (const id of ids.filter(Boolean)) chain.push({ id: `openrouter/${id}`, model: openrouter(id) });
  }
  return chain;
}

export class GenerationUnavailable extends Error {
  constructor(public readonly attempts: { model: string; error: string }[]) {
    super(attempts.length ? "All models in the fallback chain failed" : "No model API keys configured");
  }
}

const PER_CALL_TIMEOUT_MS = 45_000;
/** Don't start a model call with less time than this left before the request deadline. */
const MIN_CALL_WINDOW_MS = 8_000;

/**
 * Runs one structured call down the chain; returns the first schema-valid result and which
 * model produced it. `deadline` (epoch ms) caps the whole chain so the request finishes with
 * typed JSON before the platform's maxDuration kills it.
 */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  prompt: string,
  chain: Candidate[] = modelChain(),
  deadline: number = Date.now() + 100_000,
): Promise<{ object: T; modelId: string }> {
  const attempts: { model: string; error: string }[] = [];
  for (const c of chain) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_WINDOW_MS) {
      attempts.push({ model: c.id, error: "skipped: request deadline reached" });
      continue;
    }
    try {
      const result = await generateText({
        model: c.model,
        prompt,
        output: Output.object({ schema }),
        maxRetries: remaining > 2 * PER_CALL_TIMEOUT_MS ? 1 : 0,
        abortSignal: AbortSignal.timeout(Math.min(PER_CALL_TIMEOUT_MS, remaining - 2_000)),
      });
      return { object: result.output as T, modelId: c.id };
    } catch (err) {
      // Log the class per attempt so a bad key or a schema mismatch is visible, not just exhaustion.
      // Messages are truncated provider errors; they never include our request headers or keys.
      const kind = err instanceof Error ? err.name : typeof err;
      console.warn(`[models] ${c.id} failed (${kind})`);
      attempts.push({ model: c.id, error: err instanceof Error ? err.message.slice(0, 200) : String(err) });
    }
  }
  throw new GenerationUnavailable(attempts);
}
