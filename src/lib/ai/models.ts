// Ordered fallback chain (PRD §5): primary (Gemini) → cheap fallbacks (OpenRouter) → unavailable.
// Model ids are env-overridable so a fork can pick its own without code changes.
import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import type { z } from "zod";

/**
 * Gemini models tried in order. Free-tier quotas are per model per day, so chaining several
 * multiplies the free budget; the lite models are also the fastest.
 */
export const DEFAULT_GEMINI = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

export const DEFAULT_FALLBACKS = [
  "poolside/laguna-s-2.1:free", // fastest structured output in a 2026-10-18 benchmark (~2.5s)
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
];

interface Candidate {
  id: string;
  model: LanguageModel;
}

export function modelChain(env: NodeJS.ProcessEnv = process.env): Candidate[] {
  const chain: Candidate[] = [];
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    // LAUNCHOS_PRIMARY_MODEL may be one id or a comma-separated list of Gemini models.
    const ids = env.LAUNCHOS_PRIMARY_MODEL?.trim() ? env.LAUNCHOS_PRIMARY_MODEL.split(",").map((s) => s.trim()) : DEFAULT_GEMINI;
    for (const id of ids.filter(Boolean)) chain.push({ id, model: google(id) });
  }
  if (env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
    const ids = env.LAUNCHOS_FALLBACK_MODELS?.trim() ? env.LAUNCHOS_FALLBACK_MODELS.split(",").map((s) => s.trim()) : DEFAULT_FALLBACKS;
    for (const id of ids.filter(Boolean)) chain.push({ id: `openrouter/${id}`, model: openrouter(id) });
  }
  return chain;
}

/**
 * Free models often ignore structured-output mode and answer with prose + JSON or fenced JSON.
 * Pull the outermost JSON object out of the raw text and validate it with the same schema.
 */
export function recoverJson<T>(text: string | undefined, schema: z.ZodType<T>): T | null {
  if (!text) return null;
  // Use the first fenced block if there is one; never strip fences inside JSON string values.
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
  const unfenced = fenced ? fenced[1] : text;
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(unfenced.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Loggable form of a chain failure: per-model messages when available. */
export function describeError(err: unknown): unknown {
  return err instanceof GenerationUnavailable ? err.attempts : err;
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
        // No SDK retries: the chain is the retry, and retrying a quota error only burns the deadline.
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(Math.min(PER_CALL_TIMEOUT_MS, remaining - 2_000)),
      });
      return { object: result.output as T, modelId: c.id };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        const recovered = recoverJson(err.text, schema);
        if (recovered) {
          console.warn(`[models] ${c.id} ignored structured output; JSON recovered from text`);
          return { object: recovered, modelId: c.id };
        }
      }
      // Log the class per attempt so a bad key or a schema mismatch is visible, not just exhaustion.
      // Messages are truncated provider errors; they never include our request headers or keys.
      const kind = err instanceof Error ? err.name : typeof err;
      console.warn(`[models] ${c.id} failed (${kind})`);
      attempts.push({ model: c.id, error: err instanceof Error ? err.message.slice(0, 200) : String(err) });
    }
  }
  throw new GenerationUnavailable(attempts);
}
