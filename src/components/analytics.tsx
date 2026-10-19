"use client";

import { useEffect } from "react";
import { initAnalytics, msSinceLanding, track, type AnalyticsEvent } from "@/lib/analytics";

export function AnalyticsInit() {
  useEffect(() => initAnalytics(), []);
  return null;
}

/** Fires one event when mounted (e.g. a page or section view). */
export function TrackOnMount({ event, props }: { event: AnalyticsEvent; props?: Record<string, string | number | boolean> }) {
  useEffect(() => {
    initAnalytics();
    const ms = event === "launch_room_viewed" ? msSinceLanding() : undefined;
    track(event, { ...props, ...(ms !== undefined ? { ms_since_landing: ms } : {}) });
    // Fires once per mount: props are static at every call site, so they are not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
