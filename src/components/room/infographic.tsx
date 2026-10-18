import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Highlight } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One key fact as an infographic: a chrome figure plus a 1–4 word label, optionally a meter or trend. */
export function HighlightView({ h, size = "sm" }: { h: Highlight; size?: "sm" | "lg" }) {
  const level = Math.max(0, Math.min(100, h.level ?? 0));
  const Trend = h.trend === "up" ? ArrowUpRight : h.trend === "down" ? ArrowDownRight : ArrowRight;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-chrome min-w-0 break-words font-extrabold leading-none tracking-tight",
            // Long values ("Needs input", "60 days") step down so they never overflow the tile.
            size === "lg"
              ? h.value.length > 8 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
              : h.value.length > 7 ? "text-base" : h.value.length > 4 ? "text-xl" : "text-2xl",
          )}
        >
          {h.value}
        </span>
        {h.visual === "trend" && (
          <Trend
            className={cn("shrink-0", size === "lg" ? "size-6" : "size-4", h.trend === "up" ? "text-success" : h.trend === "down" ? "text-destructive" : "text-muted-foreground")}
            aria-label={`trend ${h.trend ?? "flat"}`}
          />
        )}
      </div>
      {h.visual === "meter" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${level}%`}>
          <div className="h-full rounded-full bg-gradient-to-r from-brand-burgundy to-primary" style={{ width: `${level}%` }} />
        </div>
      )}
      <span className={cn("leading-snug text-muted-foreground", size === "lg" ? "text-sm" : "text-xs")}>{h.label}</span>
    </div>
  );
}
