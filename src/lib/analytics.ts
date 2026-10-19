"use client";

// Product analytics (docs/metrics.md). Event names are a closed union — exactly the names in the
// metrics tree. Privacy: no cookies (in-memory persistence), no autocapture, no session recording,
// Do-Not-Track respected, no personal data in properties. Without NEXT_PUBLIC_POSTHOG_KEY every
// call is a no-op, so forks and local runs send nothing.
import posthog from "posthog-js";

export type AnalyticsEvent =
  | "launch_room_viewed"
  | "hero_cta_click"
  | "demo_opened"
  | "brief_started"
  | "generation_started"
  | "generation_completed"
  | "kit_generated"
  | "consistency_check_run"
  | "room_shared"
  | "analysis_completed"
  | "alignment_locked"
  | "rollout_stage_completed"
  | "stage_notification_opened"
  | "metrics_dashboard_viewed"
  | "bottleneck_suggestion_shown"
  | "bottleneck_suggestion_clicked";

type Props = Record<string, string | number | boolean>;

let started = false;
const LANDED_AT = "launchos:landed-at";

export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (started || !key || typeof window === "undefined") return;
  // Automated browsers (Playwright visual QA, crawlers that admit it) never count as visitors.
  if (navigator.webdriver) return;
  started = true;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    persistence: "memory",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    respect_dnt: true,
    person_profiles: "never",
  });
  try {
    if (!sessionStorage.getItem(LANDED_AT)) sessionStorage.setItem(LANDED_AT, String(Date.now()));
  } catch {
    /* storage blocked: the time-to-room guardrail just isn't measured */
  }
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (!started) return;
  posthog.capture(event, props);
}

/** Milliseconds since the first page of this session — the "time to demo room" guardrail. */
export function msSinceLanding(): number | undefined {
  try {
    const t = Number(sessionStorage.getItem(LANDED_AT));
    return t ? Date.now() - t : undefined;
  } catch {
    return undefined;
  }
}
