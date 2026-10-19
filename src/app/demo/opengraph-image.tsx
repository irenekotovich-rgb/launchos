import { OG_SIZE, ogCard } from "@/lib/og/card";

export const alt = "Demo launch room for the fictional product Launch Service — LaunchOS by Iryna Kotovych.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return ogCard({
    kicker: "Demo launch · fictional",
    title: "Launch Service",
    stats: [
      { value: "Tier T2", label: "suggested from the brief" },
      { value: "30%", label: "of audience live" },
      { value: "3 + 2", label: "success · failure metrics" },
    ],
  });
}
