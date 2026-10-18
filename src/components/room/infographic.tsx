import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp } from "lucide-react";
import type { Highlight } from "@/lib/types";
import { cn } from "@/lib/utils";

export const NEEDS_INPUT = "needs input";

/**
 * One key fact as an infographic, rendered as a <dt>/<dd> pair (label: value).
 * `onMetal` = on a burgundy tile, where chrome lettering lacks contrast, so figures are solid white.
 * "Needs input" never looks like a real figure: muted, dashed, with an icon.
 */
export function HighlightView({ h, size = "sm", onMetal = false }: { h: Highlight; size?: "sm" | "lg"; onMetal?: boolean }) {
  const level = Math.max(0, Math.min(100, h.level ?? 0));
  const missing = h.value.trim().toLowerCase() === NEEDS_INPUT;
  const Trend = h.trend === "up" ? ArrowUpRight : h.trend === "down" ? ArrowDownRight : ArrowRight;
  const big = size === "lg";
  return (
    // Column-reverse keeps <dt> first in the DOM (label: value) but shows the figure on top; justify-end pins it to the top.
    <div className="flex min-w-0 flex-col-reverse justify-end gap-1">
      <dt className={cn("leading-snug", big ? "text-sm" : "text-xs", onMetal ? "text-white" : "text-muted-foreground")}>{h.label}</dt>
      <dd className="flex flex-col gap-1">
        {missing ? (
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 font-semibold",
              big ? "text-base" : "text-xs",
              onMetal ? "border-white/60 text-white" : "border-warning/60 text-warning",
            )}
          >
            <CircleHelp className="size-3.5" aria-hidden /> Needs input
          </span>
        ) : (
          <span className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "min-w-0 break-words font-extrabold leading-none tracking-tight",
                onMetal ? "text-white" : "text-chrome",
                // Long values step down so they never overflow the tile.
                big
                  ? h.value.length > 8 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
                  : h.value.length > 7 ? "text-base" : h.value.length > 4 ? "text-xl" : "text-2xl",
              )}
            >
              {h.value}
            </span>
            {h.visual === "trend" && (
              <Trend
                className={cn("shrink-0", big ? "size-6" : "size-4", onMetal ? "text-white" : "text-foreground")}
                aria-label={`${h.label}: trending ${h.trend ?? "flat"}`}
              />
            )}
          </span>
        )}
        {h.visual === "meter" && !missing && (
          <div
            role="meter"
            aria-label={h.label}
            aria-valuenow={level}
            aria-valuemin={0}
            aria-valuemax={100}
            className={cn("h-1.5 w-full overflow-hidden rounded-full", onMetal ? "bg-black/40" : "bg-secondary")}
          >
            <div className={cn("h-full rounded-full", onMetal ? "bg-white" : "bg-gradient-to-r from-brand-burgundy to-primary")} style={{ width: `${level}%` }} />
          </div>
        )}
      </dd>
    </div>
  );
}
