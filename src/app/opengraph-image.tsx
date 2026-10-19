import { OG_SIZE, ogCard } from "@/lib/og/card";
import { ASSET_TYPES, ROLLOUT_STEPS } from "@/lib/types";

export const alt = "LaunchOS — your launch, in one URL. Made by Iryna Kotovych.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return ogCard({
    kicker: "Open-source launch room",
    title: "Your launch, in one URL.",
    tagline: "Open source · bring your own key",
    stats: [
      { value: String(ASSET_TYPES.length), label: "assets from one brief" },
      { value: `${ROLLOUT_STEPS[0].cumulative}→${ROLLOUT_STEPS.at(-1)!.cumulative}%`, label: "staged rollout" },
      { value: "1 rubric", label: "drift check" },
    ],
  });
}
