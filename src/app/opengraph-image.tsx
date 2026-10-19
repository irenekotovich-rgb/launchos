import { OG_SIZE, ogCard } from "@/lib/og/card";

export const alt = "LaunchOS — your launch, in one URL. Made by Iryna Kotovych.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return ogCard({
    kicker: "Open-source launch room",
    title: "Your launch, in one URL.",
    stats: [
      { value: "8", label: "assets from one brief" },
      { value: "10→100%", label: "staged rollout" },
      { value: "1 rubric", label: "drift check" },
    ],
  });
}
