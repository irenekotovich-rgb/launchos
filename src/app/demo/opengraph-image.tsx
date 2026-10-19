import { OG_SIZE, ogCard } from "@/lib/og/card";
import { getDemoLaunch } from "@/lib/demo";
import { rolledOutPercent } from "@/lib/launch-status";
import { METRIC_LIMITS } from "@/lib/types";

export const alt = "Demo launch room for the fictional product Launch Service — LaunchOS by Iryna Kotovych.";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Values come from the demo LaunchDoc itself, so the card can't drift from the demo. */
export default async function Image() {
  const doc = getDemoLaunch();
  return ogCard({
    kicker: "Demo launch · fictional",
    title: doc.brief.productName,
    stats: [
      { value: `Tier ${doc.tier.tier}`, label: "suggested from the brief" },
      { value: `${rolledOutPercent(doc)}%`, label: "of audience live" },
      { value: `${METRIC_LIMITS.success} + ${METRIC_LIMITS.failure}`, label: "success · failure metrics" },
    ],
  });
}
