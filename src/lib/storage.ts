// Own launches live in this browser only (no database in v1, docs/PRD.md §5).
// Every access is guarded: storage can be unavailable (private mode, blocked site data).

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

export function loadLaunch(id: string): LaunchDoc | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as LaunchDoc) : null;
  } catch {
    return null;
  }
}
