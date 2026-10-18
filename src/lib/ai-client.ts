// Browser-side calls to the model routes. Every failure resolves to { ok: false, message } —
// the room shows it inline; nothing throws into an error screen.
import { applyConsistency, replaceAsset } from "./edit";
import type { AssetType, LaunchDoc, Messaging } from "./types";
import type { AssetResponse } from "@/app/api/asset/route";
import type { ConsistencyResponse } from "@/app/api/consistency/route";

/** Launches built while generation was unavailable have no messaging block; fall back to the brief itself. */
export function messagingOrBrief(doc: LaunchDoc): Messaging {
  return doc.messaging ?? { positioning: doc.brief.what, pillars: [], proofPoints: doc.brief.claims, avoid: [] };
}

type Result = { ok: true; doc: LaunchDoc } | { ok: false; message: string };

async function post<T>(url: string, body: unknown, fetcher: typeof fetch): Promise<T | { status: "unavailable"; message: string }> {
  try {
    const r = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await r.json()) as T;
  } catch {
    return { status: "unavailable", message: "Couldn't reach the server — check your connection and try again." };
  }
}

export async function runConsistencyCheck(doc: LaunchDoc, fetcher: typeof fetch = fetch): Promise<Result> {
  const assets = doc.assets.filter((a) => a.content).map(({ id, type, title, content }) => ({ id, type, title, content }));
  if (!assets.length) return { ok: false, message: "There are no assets to check yet." };
  const res = await post<ConsistencyResponse>("/api/consistency", { brief: doc.brief, messaging: messagingOrBrief(doc), assets }, fetcher);
  if (res.status !== "ok") return { ok: false, message: res.message };
  return { ok: true, doc: applyConsistency(doc, res.result.findings, res.result.model, new Date()) };
}

export async function regenerateAsset(doc: LaunchDoc, type: AssetType, fetcher: typeof fetch = fetch): Promise<Result> {
  const res = await post<AssetResponse>("/api/asset", { brief: doc.brief, messaging: messagingOrBrief(doc), type }, fetcher);
  if (res.status !== "ok") return { ok: false, message: res.message };
  return { ok: true, doc: replaceAsset(doc, res.result.asset, res.result.model, new Date()) };
}
