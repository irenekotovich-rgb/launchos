"use client";

import Link from "next/link";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/** A Link that records one analytics event on click (server pages stay server components). */
export function TrackedLink({
  event,
  props,
  ...link
}: React.ComponentProps<typeof Link> & { event: AnalyticsEvent; props?: Record<string, string | number | boolean> }) {
  return <Link {...link} onClick={() => track(event, props)} />;
}
