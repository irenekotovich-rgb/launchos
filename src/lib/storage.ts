// Own launches live in this browser only (no database in v1, docs/PRD.md §5).
// Every access is guarded: storage can be unavailable (private mode, blocked site data).

import { isLaunchDoc, sanitizeLaunchDoc } from "./validate";
import type { LaunchDoc } from "./types";

const PREFIX = "launchos:launch:";

export function saveLaunch(doc: LaunchDoc): boolean {
  try {
    localStorage.setItem(PREFIX + doc.meta.id, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export type LoadResult = { status: "ok"; doc: LaunchDoc } | { status: "missing" } | { status: "corrupt"; raw: string };

export function loadLaunch(id: string): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PREFIX + id);
  } catch {
    return { status: "missing" };
  }
  if (raw === null) return { status: "missing" };
  try {
    const parsed: unknown = JSON.parse(raw);
    return isLaunchDoc(parsed) ? { status: "ok", doc: sanitizeLaunchDoc(parsed) } : { status: "corrupt", raw };
  } catch {
    return { status: "corrupt", raw };
  }
}
