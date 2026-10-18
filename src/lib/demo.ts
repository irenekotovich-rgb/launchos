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

export function getDemoLaunch(now: Date = new Date()): LaunchDoc {
  return shiftDates(demoJson as LaunchDoc, now.getTime() - DEMO_AUTHORED_AT);
}
