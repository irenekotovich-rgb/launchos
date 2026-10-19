// Product analytics (docs/metrics.md). Event names are a closed union — exactly the names in the
// metrics tree. Privacy: no cookies (in-memory persistence), no autocapture, no session recording,
// Do-Not-Track respected, no launch content in properties, and URLs are reduced to route templates
// before sending (share ids are credentials). Without NEXT_PUBLIC_POSTHOG_KEY nothing loads at all:
// posthog-js is imported lazily, so forks without a key pay no bundle cost.
import type { PostHog } from "posthog-js";

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

let client: PostHog | null = null;
let started = false;
const queue: [AnalyticsEvent, Props][] = [];
const LANDED = "launchos:landed";

/** /share/<id>/… → /share/[id]/…, /launch/<id>/… → /launch/[id]/…; query strings and hashes dropped. */
export function templatePath(url: string): string {
  try {
    const u = new URL(url, "https://x.invalid");
    const path = u.pathname.replace(/^\/(share|launch)\/[^/]+/, "/$1/[id]");
    return u.origin === "https://x.invalid" ? path : `${u.origin}${path}`;
  } catch {
    return "";
  }
}

const URL_PROPS = ["$current_url", "$pathname", "$referrer", "$initial_current_url", "$initial_pathname", "$initial_referrer", "$referring_domain"];

export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (started || !key || typeof window === "undefined") return;
  // Automated browsers (Playwright visual QA, crawlers that admit it) never count as visitors.
  if (navigator.webdriver) return;
  started = true;
  try {
    if (!sessionStorage.getItem(LANDED)) sessionStorage.setItem(LANDED, JSON.stringify({ t: Date.now(), path: location.pathname }));
  } catch {
    /* storage blocked: the time-to-room guardrail just isn't measured */
  }
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      respect_dnt: true,
      person_profiles: "never",
      before_send: (event) => {
        if (!event) return event;
        for (const k of URL_PROPS) {
          const v = event.properties?.[k];
          if (typeof v === "string") event.properties[k] = k === "$referring_domain" ? v : templatePath(v);
        }
        return event;
      },
    });
    // Country only (ISO code from Vercel's edge header) — never an IP. Registered before the
    // queued events flush so every event carries it; on failure events simply have no country.
    void fetch("/api/geo")
      .then((r) => (r.ok ? (r.json() as Promise<{ country: string | null }>) : { country: null }))
      .catch(() => ({ country: null }))
      .then(({ country }) => {
        if (country) posthog.register({ country });
        client = posthog;
        for (const [e, p] of queue.splice(0)) posthog.capture(e, p);
      });
  });
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (!started) return;
  if (client) client.capture(event, props);
  else queue.push([event, props]);
}

/**
 * Milliseconds from the session's first page to now — the "time to demo room" guardrail.
 * Undefined when the session started on this very page (a deep link would report ~0 ms).
 */
export function msSinceLanding(): number | undefined {
  try {
    const landed = JSON.parse(sessionStorage.getItem(LANDED) ?? "null") as { t: number; path: string } | null;
    if (!landed || landed.path === location.pathname) return undefined;
    return Date.now() - landed.t;
  } catch {
    return undefined;
  }
}
