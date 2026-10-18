"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/launch-status";

/** Live countdown. First paint uses the server's `now`; the browser takes over after mount. */
export function Countdown({ target, initialNow }: { target: string; initialNow: string }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const c = countdown(new Date(target), now);
  const cells = [
    { v: c.days, l: "days" },
    { v: c.hours, l: "hours" },
    { v: c.minutes, l: "min" },
    { v: c.seconds, l: "sec" },
  ];
  if (c.past) {
    return <p className="text-2xl font-bold text-brand-orange">Launch day has passed</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label={`${c.days} days ${c.hours} hours to launch`}>
      {cells.map((cell) => (
        <div key={cell.l} className="rounded-xl border border-border bg-background/40 px-2 py-3 text-center">
          <b className="block font-mono text-2xl font-bold tabular-nums sm:text-3xl" suppressHydrationWarning>
            {cell.l === "days" ? cell.v : String(cell.v).padStart(2, "0")}
          </b>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{cell.l}</span>
        </div>
      ))}
    </div>
  );
}
