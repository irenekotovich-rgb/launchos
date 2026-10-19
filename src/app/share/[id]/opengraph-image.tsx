import { OG_SIZE, ogCard } from "@/lib/og/card";
import { rolledOutPercent } from "@/lib/launch-status";
import { SHARE_ID } from "@/lib/share";
import { getShare } from "@/lib/share-store";

export const alt = "Shared launch room — LaunchOS by Iryna Kotovych.";
export const size = OG_SIZE;
export const contentType = "image/png";
// Never serve a cached card for a deleted or changed snapshot.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Shows only what the snapshot already makes public: name, tier, rollout, launch day — and the
 * share dialog warns that link previews show these. Unknown/deleted link → generic card (no-store);
 * storage outage → throw (5xx), so crawlers retry instead of caching a generic card.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHARE_ID.test(id)) return ogCard({ kicker: "Shared launch room", title: "LaunchOS", headers: NO_STORE });
  const doc = await getShare(id); // throws on storage errors by design
  if (!doc) return ogCard({ kicker: "Shared launch room", title: "LaunchOS", headers: NO_STORE });
  try {
    const t = new Date(doc.brief.targetDate);
    return await ogCard({
      kicker: "Shared launch room · read-only",
      title: doc.brief.productName,
      stats: [
        { value: `Tier ${doc.tier.tier}`, label: "launch tier" },
        { value: `${rolledOutPercent(doc)}%`, label: "of audience live" },
        { value: Number.isNaN(t.getTime()) ? "—" : t.toISOString().slice(0, 10), label: "launch day" },
      ],
      headers: NO_STORE,
    });
  } catch {
    return ogCard({ kicker: "Shared launch room", title: "LaunchOS", headers: NO_STORE });
  }
}
