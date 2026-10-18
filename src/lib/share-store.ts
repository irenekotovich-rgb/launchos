// Share-link storage: one private Vercel Blob per snapshot under an unguessable id. The delete
// token is stored only as a SHA-256 hash. Without BLOB_READ_WRITE_TOKEN (local dev) an in-memory
// map is used, so the feature works in a fresh clone.
import "server-only";
import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import { randomToken, redactForShare } from "./share";
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

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createShare(doc: LaunchDoc, now = new Date()): Promise<{ id: string; deleteToken: string }> {
  const id = randomToken(24);
  const deleteToken = randomToken(24);
  const snapshot: LaunchDoc = { ...redactForShare(doc), meta: { ...redactForShare(doc).meta, sharedAt: now.toISOString() } };
  const stored: Stored = { doc: snapshot, deleteTokenHash: await sha256(deleteToken), createdAt: now.toISOString() };
  if (blobConfigured()) {
    await put(key(id), JSON.stringify(stored), { access: "private", addRandomSuffix: false, contentType: "application/json" });
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

export async function getShare(id: string): Promise<LaunchDoc | null> {
  return (await read(id))?.doc ?? null;
}

/** Deletes when the token matches; false for an unknown id or a wrong token. */
export async function deleteShare(id: string, token: string): Promise<boolean> {
  const stored = await read(id);
  if (!stored || stored.deleteTokenHash !== (await sha256(token))) return false;
  if (blobConfigured()) await del(key(id));
  else memory.delete(id);
  return true;
}
