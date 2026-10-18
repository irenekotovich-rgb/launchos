// Browser-side calls to the model routes. Every failure resolves to { ok: false, message } —
// the room shows it inline; nothing throws into an error screen.
//
// Results are returned as *edits* tagged with the brief they were computed against. The editor
// applies them to the latest doc and drops a check whose brief changed meanwhile (review PR #9).
import { applyConsistency, replaceAsset } from "./edit";
import type { AssetType, LaunchDoc, Messaging } from "./types";
import type { AssetResponse } from "@/app/api/asset/route";
import type { ConsistencyResponse } from "@/app/api/consistency/route";

/** Limits mirror lib/ai/schemas.ts consistencyRequest. */
const MAX_ASSET_CHARS = 9000;

/**
 * The messaging block to send. If it's missing (generation was unavailable) or stale (the brief was
 * edited since), the brief wins: claims become the only proof points; the avoid list is kept.
 */
export function messagingOrBrief(doc: LaunchDoc): Messaging {
  if (doc.messaging && !doc.messaging.stale) {
    const { positioning, pillars, proofPoints, avoid } = doc.messaging;
    return { positioning, pillars, proofPoints, avoid };
  }
  return { positioning: doc.brief.what, pillars: [], proofPoints: doc.brief.claims, avoid: doc.messaging?.avoid ?? [] };
}

export const briefKey = (doc: LaunchDoc) => JSON.stringify(doc.brief);

export type Edit = (doc: LaunchDoc, now: Date) => LaunchDoc;
type Result = { ok: true; brief: string; edit: Edit } | { ok: false; message: string };

async function post<T extends { status: string; message?: string }>(url: string, body: unknown, fetcher: typeof fetch): Promise<T | { status: "error"; message: string }> {
  let r: Response;
  try {
    r = await fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { status: "error", message: "Couldn't reach the server — check your connection and try again." };
  }
  if (!(r.headers.get("content-type") ?? "").includes("application/json")) {
    // Platform timeouts and gateway errors answer with HTML/text, not our typed JSON.
    return { status: "error", message: r.status >= 500 || r.status === 0 ? "The server took too long — try again." : `Unexpected response (${r.status}) — try again.` };
  }
  try {
    const json = (await r.json()) as T;
    return json && typeof json.status === "string" ? json : { status: "error", message: "Unexpected response — try again." };
  } catch {
    return { status: "error", message: "Unexpected response — try again." };
  }
}

const failMessage = (res: { message?: string }) => res.message || "Something went wrong — try again.";

export async function runConsistencyCheck(doc: LaunchDoc, fetcher: typeof fetch = fetch): Promise<Result> {
  const assets = doc.assets
    .filter((a) => a.content)
    .map(({ id, type, title, content }) => ({ id, type, title: title.slice(0, 200), content: content.slice(0, MAX_ASSET_CHARS) }));
  if (!assets.length) return { ok: false, message: "There are no assets to check yet." };
  const brief = briefKey(doc);
  const res = await post<ConsistencyResponse>("/api/consistency", { brief: doc.brief, messaging: messagingOrBrief(doc), assets }, fetcher);
  if (res.status !== "ok" || !("result" in res)) return { ok: false, message: failMessage(res) };
  const { findings, model } = res.result;
  return { ok: true, brief, edit: (d, now) => applyConsistency(d, findings, model, now) };
}

export async function regenerateAsset(doc: LaunchDoc, type: AssetType, fetcher: typeof fetch = fetch): Promise<Result> {
  const brief = briefKey(doc);
  const metrics = doc.alignment.metrics.map((m) => `${m.name} (${m.kind})`).slice(0, 5);
  const res = await post<AssetResponse>("/api/asset", { brief: doc.brief, messaging: messagingOrBrief(doc), type, metrics }, fetcher);
  if (res.status !== "ok" || !("result" in res)) return { ok: false, message: failMessage(res) };
  const { asset, model } = res.result;
  return { ok: true, brief, edit: (d, now) => replaceAsset(d, asset, model, now) };
}
