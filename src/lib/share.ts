// Export / share helpers shared by client and server. Pure — no I/O here.
import { AUTHOR } from "./author";
import type { LaunchDoc, TeamKey, TeamSignoff } from "./types";

/** Exported files carry the author attribution at the top level (CLAUDE.md). */
export interface ExportFile extends LaunchDoc {
  author: { name: string; url: string };
  exportedAt: string;
}

export function toExportFile(doc: LaunchDoc, now: Date): ExportFile {
  return { ...doc, author: { name: AUTHOR.name, url: AUTHOR.url }, exportedAt: now.toISOString() };
}

export function exportFileName(doc: LaunchDoc): string {
  const slug = doc.brief.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "launch";
  return `launchos-${slug}.json`;
}

/**
 * What a read-only share link may contain (PRD §5): no recipient emails, no sign-off names or
 * notes, no share secrets. Everything else is the launch as the owner sees it.
 */
export function redactForShare(doc: LaunchDoc): LaunchDoc {
  const signoffs = Object.fromEntries(
    (Object.entries(doc.alignment.signoffs) as [TeamKey, TeamSignoff][]).map(([team, s]) => [team, { ...s, lead: "", note: "" }]),
  ) as Record<TeamKey, TeamSignoff>;
  const { share: _share, ...meta } = doc.meta;
  void _share;
  return {
    ...doc,
    meta,
    alignment: { ...doc.alignment, signoffs },
    rollout: { ...doc.rollout, recipients: [] },
  };
}

/** 32 random bytes as base64url — unguessable share ids and delete tokens. */
export function randomToken(bytes = 24): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const SHARE_ID = /^[A-Za-z0-9_-]{32}$/;
