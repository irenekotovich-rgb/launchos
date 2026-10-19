import { OG_SIZE, ogCard } from "@/lib/og/card";
import { rolledOutPercent } from "@/lib/launch-status";
import { SHARE_ID } from "@/lib/share";
import { getShare } from "@/lib/share-store";

export const alt = "Shared launch room — LaunchOS by Iryna Kotovych.";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The preview shows only what the snapshot already makes public: name, tier, rollout. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = SHARE_ID.test(id) ? await getShare(id).catch(() => null) : null;
  if (!doc) return ogCard({ kicker: "Shared launch room", title: "LaunchOS" });
  return ogCard({
    kicker: "Shared launch room · read-only",
    title: doc.brief.productName,
    stats: [
      { value: `Tier ${doc.tier.tier}`, label: "launch tier" },
      { value: `${rolledOutPercent(doc)}%`, label: "of audience live" },
      { value: new Date(doc.brief.targetDate).toISOString().slice(0, 10), label: "launch day" },
    ],
  });
}
