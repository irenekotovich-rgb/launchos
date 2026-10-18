// Loads versioned prompts from /prompts (never inline in code — CLAUDE.md).
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface Prompt {
  name: string;
  version: number;
  body: string;
}

const cache = new Map<string, Prompt>();

export async function loadPrompt(name: string): Promise<Prompt> {
  const hit = cache.get(name);
  if (hit) return hit;
  const raw = await readFile(path.join(process.cwd(), "prompts", `${name}.md`), "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`prompts/${name}.md has no frontmatter`);
  const version = Number(match[1].match(/^version:\s*(\d+)/m)?.[1]);
  if (!version) throw new Error(`prompts/${name}.md has no version`);
  const prompt = { name, version, body: match[2].trim() };
  cache.set(name, prompt);
  return prompt;
}

/** Replaces {{key}} placeholders; an unknown placeholder is an error, not a silent blank. */
export function render(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`Missing prompt variable: ${key}`);
    return vars[key];
  });
}
