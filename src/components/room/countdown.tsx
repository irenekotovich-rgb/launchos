"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/launch-status";

/**
 * Live countdown. First paint uses the server's `now` (no hydration mismatch); the browser
 * clock takes over after mount. `live={false}` keeps it frozen at `initialNow` — used when a
 * QA `?now=` override renders the room at another moment, so the countdown agrees with it.
 */
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

export function Countdown({ target, initialNow, live = true }: { target: string; initialNow: string; live?: boolean }) {
  // State is the current minute, so React skips re-renders when the minute hasn't changed.
  const minuteOf = (d: Date) => Math.floor(d.getTime() / 60_000);
  const [minute, setMinute] = useState(() => minuteOf(new Date(initialNow)));
  useEffect(() => {
    if (!live) return;
    const tick = () => setMinute(minuteOf(new Date()));
    tick();
    // Minute precision is all the countdown shows (owner: no seconds), so a 15 s tick is plenty;
    // background tabs throttle timers, so also re-sync when the tab becomes visible.
    const t = setInterval(tick, 15_000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live]);
  const c = countdown(new Date(target), new Date(minute * 60_000));
  const cells = [
    { v: c.days, l: "days" },
    { v: c.hours, l: "hours" },
    { v: c.minutes, l: "min" },
  ];
  if (c.past) {
    return <p className="text-2xl font-bold text-white">Launch day has passed</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2" role="timer" aria-label={`${plural(c.days, "day")} ${plural(c.hours, "hour")} ${plural(c.minutes, "minute")} to launch`}>
      {cells.map((cell) => (
        // The wrapper's label is the accessible value; the cells are visual only (no double reading).
        <div aria-hidden key={cell.l} className="rounded-2xl border border-white/15 bg-black/35 px-1 py-3 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]">
          <b className="text-chrome block font-mono text-2xl font-extrabold tabular-nums sm:text-3xl">
            {cell.l === "days" ? cell.v : String(cell.v).padStart(2, "0")}
          </b>
          <span className="text-xs uppercase tracking-wider text-white">{cell.l}</span>
        </div>
      ))}
    </div>
  );
}
