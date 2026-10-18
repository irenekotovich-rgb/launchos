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

/** Runs one structured call down the chain; returns the first schema-valid result and which model produced it. */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  prompt: string,
  chain: Candidate[] = modelChain(),
): Promise<{ object: T; modelId: string }> {
  const attempts: { model: string; error: string }[] = [];
  for (const c of chain) {
    try {
      const result = await generateText({
        model: c.model,
        prompt,
        output: Output.object({ schema }),
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(45_000),
      });
      return { object: result.output as T, modelId: c.id };
    } catch (err) {
      attempts.push({ model: c.id, error: err instanceof Error ? err.message.slice(0, 200) : String(err) });
    }
  }
  throw new GenerationUnavailable(attempts);
}
