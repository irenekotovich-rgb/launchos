"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/launch-status";

/**
 * Live countdown. First paint uses the server's `now` (no hydration mismatch); the browser
 * clock takes over after mount. `live={false}` keeps it frozen at `initialNow` — used when a
 * QA `?now=` override renders the room at another moment, so the countdown agrees with it.
 */
export function Countdown({ target, initialNow, live = true }: { target: string; initialNow: string; live?: boolean }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    if (!live) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [live]);
  const c = countdown(new Date(target), now);
  const cells = [
    { v: c.days, l: "days" },
    { v: c.hours, l: "hours" },
    { v: c.minutes, l: "min" },
    { v: c.seconds, l: "sec" },
  ];
  if (c.past) {
    return <p className="text-2xl font-bold text-white">Launch day has passed</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label={`${c.days} days ${c.hours} hours to launch`}>
      {cells.map((cell) => (
        <div key={cell.l} className="rounded-2xl border border-white/15 bg-black/35 px-1 py-3 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]">
          <b className="text-chrome block font-mono text-3xl font-extrabold tabular-nums">
            {cell.l === "days" ? cell.v : String(cell.v).padStart(2, "0")}
          </b>
          <span className="text-[11px] uppercase tracking-wider text-white/75">{cell.l}</span>
        </div>
      ))}
    </div>
  );
}
