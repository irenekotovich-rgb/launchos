"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Minus, X } from "lucide-react";
import type { Suggestion } from "@/lib/launch-status";
import { cn } from "@/lib/utils";

/** How many popups show at once before "N more". */
const VISIBLE = 2;

/**
 * Possible bottlenecks as small dismissible popups. Advisory only: they never block the page.
 * Phones start minimised to a pill so content stays usable; larger screens start open.
 */
export function Suggestions({ items, storageKey }: { items: Suggestion[]; storageKey: string }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [minimised, setMinimised] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
      /* storage unavailable: start with nothing dismissed */
    }
    setMinimised(!window.matchMedia("(min-width: 640px)").matches);
    setMounted(true);
  }, [storageKey]);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* dismissal just won't persist */
    }
  };

  const open = items.filter((s) => !dismissed.includes(s.id));
  if (!mounted || !open.length) return null;
  const warn = open.some((s) => s.severity === "warn");

  if (minimised) {
    return (
      <button
        type="button"
        onClick={() => setMinimised(false)}
        className="surface fixed right-3 bottom-3 z-40 flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold shadow-xl sm:right-4 sm:bottom-4"
        aria-label={`Show ${open.length} suggestion${open.length === 1 ? "" : "s"} about possible bottlenecks`}
      >
        <Lightbulb className={cn("size-4", warn ? "text-brand-orange" : "text-primary")} aria-hidden />
        {open.length} suggestion{open.length === 1 ? "" : "s"}
      </button>
    );
  }

  const shown = showAll ? open : open.slice(0, VISIBLE);
  return (
    <aside
      aria-label="Suggestions: possible bottlenecks"
      className="fixed inset-x-3 bottom-3 z-40 flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-80"
    >
      <div className="surface flex items-center justify-between gap-2 rounded-lg py-1 pr-1 pl-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Suggestions · {open.length}
        </p>
        <button
          type="button"
          onClick={() => setMinimised(true)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Minimise suggestions"
        >
          <Minus className="size-3.5" />
        </button>
      </div>
      {shown.map((s) => (
        <div
          key={s.id}
          role="status"
          className={cn(
            "surface flex gap-2.5 rounded-lg border-l-4 px-3 py-2 text-xs shadow-xl",
            s.severity === "warn" ? "border-l-brand-orange" : "border-l-primary",
          )}
        >
          <div className="min-w-0 flex-1">
            <a href={`#${s.section}`} className="text-sm font-semibold leading-snug hover:underline">
              {s.title}
            </a>
            <p className="mt-0.5 line-clamp-2 break-words text-muted-foreground" title={s.detail}>{s.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(s.id)}
            className="-mr-1 h-fit rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Dismiss suggestion: ${s.title}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {open.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="surface self-end rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Show fewer" : `${open.length - VISIBLE} more`}
        </button>
      )}
    </aside>
  );
}
