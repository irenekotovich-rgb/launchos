// Share-link storage: one private Vercel Blob per snapshot under an unguessable id. The delete
// token is stored only as a SHA-256 hash. Without BLOB_READ_WRITE_TOKEN (local dev) an in-memory
// map is used, so the feature works in a fresh clone.
import "server-only";
import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";
import { randomToken, redactForShare, SHARE_TTL_DAYS } from "./share";
import { isLaunchDoc } from "./validate";
import type { LaunchDoc } from "./types";

interface Stored {
  doc: LaunchDoc;
  deleteTokenHash: string;
  createdAt: string;
}

const memory = new Map<string, Stored>();
const key = (id: string) => `shares/${id}.json`;
const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export class ShareStorageMissing extends Error {}

/** On Vercel the in-memory fallback would give links that 404 on other instances — refuse instead. */
function assertStorage() {
  if (!blobConfigured() && process.env.VERCEL) throw new ShareStorageMissing("BLOB_READ_WRITE_TOKEN is not configured");
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createShare(doc: LaunchDoc, now = new Date()): Promise<{ id: string; deleteToken: string }> {
  assertStorage();
  const id = randomToken(24);
  const deleteToken = randomToken(24);
  const redacted = redactForShare(doc);
  const snapshot: LaunchDoc = { ...redacted, meta: { ...redacted.meta, sharedAt: now.toISOString() } };
  const stored: Stored = { doc: snapshot, deleteTokenHash: await sha256(deleteToken), createdAt: now.toISOString() };
  if (blobConfigured()) {
    // Short cache so a delete takes effect within a minute even under CDN caching.
    await put(key(id), JSON.stringify(stored), { access: "private", addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 });
  } else {
    memory.set(id, stored);
  }
  return { id, deleteToken };
}

async function read(id: string): Promise<Stored | null> {
  if (!blobConfigured()) return memory.get(id) ?? null;
  try {
    const res = await get(key(id), { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    const parsed = JSON.parse(await new Response(res.stream).text()) as Stored;
    return parsed && isLaunchDoc(parsed.doc) ? parsed : null;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return null;
    throw err;
  }
}

async function remove(id: string) {
  if (blobConfigured()) await del(key(id));
  else memory.delete(id);
}

/** Expired snapshots (older than SHARE_TTL_DAYS) are deleted on read, so orphaned links don't live forever. */
export async function getShare(id: string, now = new Date()): Promise<LaunchDoc | null> {
  const stored = await read(id);
  if (!stored) return null;
  if (now.getTime() - Date.parse(stored.createdAt) > SHARE_TTL_DAYS * 86_400_000) {
    await remove(id).catch(() => {});
    return null;
  }
  return stored.doc;
}

export type DeleteResult = "deleted" | "not-found" | "wrong-token";

export async function deleteShare(id: string, token: string): Promise<DeleteResult> {
  const stored = await read(id);
  if (!stored) return "not-found";
  const a = Buffer.from(stored.deleteTokenHash, "hex");
  const b = Buffer.from(await sha256(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "wrong-token";
  await remove(id);
  return "deleted";
}
