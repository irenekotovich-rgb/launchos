// The demo launch is fictional ("Launch Service") and authored around a fixed "now".
// To keep the countdown and rollout meaningful on any day, every date in the doc is
// shifted by the same offset so the demo always sits mid-rollout. Labeled demo on screen.

import demoJson from "../../data/demo-launch.json";
import type { LaunchDoc } from "./types";

/** The moment data/demo-launch.json was written against. */
export const DEMO_AUTHORED_AT = Date.parse("2026-10-18T09:00:00.000Z");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/** Returns a deep copy of `value` with every ISO date string moved by `offsetMs`. */
export function shiftDates<T>(value: T, offsetMs: number): T {
  if (typeof value === "string" && ISO_DATE.test(value)) {
    return new Date(Date.parse(value) + offsetMs).toISOString() as T;
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, offsetMs)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shiftDates(v, offsetMs)]),
    ) as T;
  }
  return value;
}

const HOUR = 3_600_000;

/**
 * The offset is snapped to whole hours, so a server render and a client render within
 * the same hour produce identical docs (no hydration mismatch). Pages that show the demo
 * render per request and pass `now` down; they are never statically prerendered.
 */
export function getDemoLaunch(now: Date = new Date()): LaunchDoc {
  const offset = Math.floor((now.getTime() - DEMO_AUTHORED_AT) / HOUR) * HOUR;
  return shiftDates(demoJson as unknown as LaunchDoc, offset);
}
