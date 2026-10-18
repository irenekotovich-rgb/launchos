// Export / share helpers shared by client and server. Pure — no I/O here.
import { AUTHOR } from "./author";
import type { LaunchDoc, TeamKey, TeamSignoff } from "./types";

/** Exported files carry the author attribution at the top level (CLAUDE.md). */
export interface ExportFile extends LaunchDoc {
  author: { name: string; url: string };
  exportedAt: string;
}

/** The share delete token never leaves the owner's browser, not even in an export. */
export function toExportFile(doc: LaunchDoc, now: Date): ExportFile {
  const { share: _share, ...meta } = doc.meta;
  void _share;
  return { ...doc, meta, author: { name: AUTHOR.name, url: AUTHOR.url }, exportedAt: now.toISOString() };
}

export function exportFileName(doc: LaunchDoc): string {
  const slug = doc.brief.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "launch";
  return `launchos-${slug}.json`;
}

/**
 * What a read-only share link may contain (PRD §5). Removed: recipient emails, sign-off leads and
 * notes, metric and checklist owners, checklist notes, the owner's local id, generation notes and
 * share secrets. Free text the PMM wrote (brief, analysis, assets, decisions) is published as written —
 * the confirm step says so and flags email addresses it finds.
 */
export function redactForShare(doc: LaunchDoc): LaunchDoc {
  const signoffs = Object.fromEntries(
    (Object.entries(doc.alignment.signoffs) as [TeamKey, TeamSignoff][]).map(([team, s]) => [team, { ...s, lead: "", note: "" }]),
  ) as Record<TeamKey, TeamSignoff>;
  const { share: _share, generation: _gen, ...meta } = doc.meta;
  void _share;
  void _gen;
  return {
    ...doc,
    meta: { ...meta, id: "shared" },
    alignment: { ...doc.alignment, signoffs, metrics: doc.alignment.metrics.map((m) => ({ ...m, owner: "" })) },
    checklist: doc.checklist.map((c) => ({ ...c, owner: "", note: "" })),
    rollout: { ...doc.rollout, recipients: [] },
  };
}

const EMAIL_IN_TEXT = /[^\s@"<>()]+@[^\s@"<>()]+\.[a-z]{2,}/gi;

/** Email addresses that would still be published (in free text) after redaction. */
export function emailsInSnapshot(doc: LaunchDoc): string[] {
  return [...new Set(JSON.stringify(redactForShare(doc)).match(EMAIL_IN_TEXT) ?? [])];
}

/** Share links expire; the snapshot is deleted on first read after this. */
export const SHARE_TTL_DAYS = 90;

/** `bytes` random bytes as base64url (24 bytes → 32 chars, 192 bits) — share ids and delete tokens. */
export function randomToken(bytes = 24): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const SHARE_ID = /^[A-Za-z0-9_-]{32}$/;
