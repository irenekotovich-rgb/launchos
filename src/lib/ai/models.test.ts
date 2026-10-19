import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
const { recoverJson } = await import("./models");

const schema = z.object({ findings: z.array(z.object({ assetId: z.string() })) });

describe("recoverJson", () => {
  it("extracts fenced or prose-wrapped JSON and validates it", () => {
    expect(recoverJson('Sure! ```json\n{"findings":[{"assetId":"a1"}]}\n``` Hope this helps.', schema)).toEqual({ findings: [{ assetId: "a1" }] });
    expect(recoverJson('{"findings": []}', schema)).toEqual({ findings: [] });
  });
  it("returns null for invalid shapes or no JSON", () => {
    expect(recoverJson('{"wrong": true}', schema)).toBeNull();
    expect(recoverJson("no json here", schema)).toBeNull();
    expect(recoverJson(undefined, schema)).toBeNull();
  });
});

describe("recoverJson edge cases (review PR #9)", () => {
  const s = z.object({ content: z.string() });
  it("keeps fences inside string values intact", () => {
    const raw = '{"content":"Use this:\\n```js\\nrun()\\n```"}';
    expect(recoverJson(raw, s)?.content).toContain("```js");
  });
  it("prefers the first fenced block when prose has braces", () => {
    expect(recoverJson('Here {draft}:\n```json\n{"content":"ok"}\n```\nNote {x}', s)).toEqual({ content: "ok" });
  });
});

describe("model chain order", async () => {
  const { modelChain } = await import("./models");
  it("chains several Gemini models before OpenRouter (free quotas are per model)", () => {
    const ids = modelChain({ GOOGLE_GENERATIVE_AI_API_KEY: "k", OPENROUTER_API_KEY: "k" } as unknown as NodeJS.ProcessEnv).map((c) => c.id);
    expect(ids.slice(0, 3)).toEqual(["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]);
    expect(ids[3]).toMatch(/^openrouter\//);
  });
  it("accepts a comma-separated Gemini override", () => {
    const ids = modelChain({ GOOGLE_GENERATIVE_AI_API_KEY: "k", LAUNCHOS_PRIMARY_MODEL: "a, b" } as unknown as NodeJS.ProcessEnv).map((c) => c.id);
    expect(ids).toEqual(["a", "b"]);
  });
});
