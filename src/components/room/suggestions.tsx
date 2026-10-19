"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Minus, X } from "lucide-react";
import type { Suggestion } from "@/lib/launch-status";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/** How many popups show at once before "N more". */
const VISIBLE = 2;

/**
 * Possible bottlenecks as small dismissible popups. Advisory only: they never block the page
 * and are not live regions (no announcement storm on load).
 * Phones start minimised to a pill so content stays usable; larger screens start open.
 */
export function Suggestions({ items, storageKey }: { items: Suggestion[]; storageKey: string }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [minimised, setMinimised] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Where focus should go after the focused control unmounts.
  const focusNext = useRef<"pill" | "panel" | null>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLParagraphElement>(null);

  const idsKey = items.map((s) => s.id).join("|");
  useEffect(() => {
    const ids = new Set(idsKey.split("|"));
    try {
      // Prune ids whose condition has cleared, so a recurring bottleneck shows again.
      const stored: string[] = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      const kept = stored.filter((id) => ids.has(id));
      setDismissed(kept);
      localStorage.setItem(storageKey, JSON.stringify(kept));
    } catch {
      /* storage unavailable: start with nothing dismissed */
    }
    setMinimised(!window.matchMedia("(min-width: 640px)").matches);
    setMounted(true);
  }, [storageKey, idsKey]);

  useEffect(() => {
    if (focusNext.current === "pill") pillRef.current?.focus();
    if (focusNext.current === "panel") headingRef.current?.focus();
    focusNext.current = null;
  });

  const persist = (next: string[]) => {
    setDismissed(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* dismissal just won't persist */
    }
  };
  const minimise = () => {
    focusNext.current = "pill";
    setMinimised(true);
  };
  const expand = () => {
    focusNext.current = "panel";
    setMinimised(false);
  };
  const dismiss = (id: string) => {
    focusNext.current = "panel";
    persist([...dismissed, id]);
  };

  const open = items.filter((s) => !dismissed.includes(s.id));
  return <SuggestionsView {...{ open, dismissed, minimised, showAll, setShowAll, mounted, expand, minimise, dismiss, persist, pillRef, headingRef, setMinimised }} />;
}

/** Kind of a suggestion id without launch-specific parts, e.g. "metric-near" — safe as an analytics property. */
const kindOf = (id: string) => id.replace(/-(f|s|d|c)-[\w-]+$|-\d+$|-(analysis|alignment|brief|assets|readiness|rollout)$/g, "");

function SuggestionsView({
  open, dismissed, minimised, showAll, setShowAll, mounted, expand, minimise, dismiss, persist, pillRef, headingRef, setMinimised,
}: {
  open: Suggestion[]; dismissed: string[]; minimised: boolean; showAll: boolean; setShowAll: (f: (v: boolean) => boolean) => void; mounted: boolean;
  expand: () => void; minimise: () => void; dismiss: (id: string) => void; persist: (n: string[]) => void;
  pillRef: React.RefObject<HTMLButtonElement | null>; headingRef: React.RefObject<HTMLParagraphElement | null>; setMinimised: (v: boolean) => void;
}) {
  const shownKey = open.map((s) => s.id).join("|");
  useEffect(() => {
    if (!mounted) return;
    for (const s of open) track("bottleneck_suggestion_shown", { kind: kindOf(s.id), severity: s.severity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, shownKey]);
  if (!mounted) return null;
  const warn = open.some((s) => s.severity === "warn");

  if (!open.length) {
    if (!dismissed.length) return null;
    return (
      <button
        ref={pillRef}
        type="button"
        onClick={() => persist([])}
        className="surface fixed right-3 bottom-3 z-40 min-h-9 rounded-full px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xl hover:text-foreground sm:right-4 sm:bottom-4"
      >
        Show {dismissed.length} dismissed suggestion{dismissed.length === 1 ? "" : "s"}
      </button>
    );
  }

  if (minimised) {
    return (
      <button
        ref={pillRef}
        type="button"
        onClick={expand}
        className="surface fixed right-3 bottom-3 z-40 flex min-h-9 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold shadow-xl sm:right-4 sm:bottom-4"
        aria-label={`Show ${open.length} suggestion${open.length === 1 ? "" : "s"} about possible bottlenecks`}
      >
        <Lightbulb className={cn("size-4", warn ? "text-brand-orange" : "text-primary")} aria-hidden />
        {open.length} suggestion{open.length === 1 ? "" : "s"}
      </button>
    );
  }

  const shown = showAll ? open : open.slice(0, VISIBLE);
  const onNarrow = () => window.matchMedia("(max-width: 639px)").matches;
  return (
    <aside
      aria-labelledby="suggestions-heading"
      className="fixed inset-x-3 bottom-3 z-40 flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-80"
    >
      <div className="surface flex items-center justify-between gap-2 rounded-lg py-0.5 pr-0.5 pl-3">
        <p id="suggestions-heading" ref={headingRef} tabIndex={-1} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground outline-none">
          Suggestions · {open.length}
        </p>
        <button
          type="button"
          onClick={minimise}
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Minimise suggestions"
        >
          <Minus className="size-4" />
        </button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {shown.map((s) => (
          <li
            key={s.id}
            className={cn(
              "surface flex gap-1.5 rounded-lg border-l-4 py-2 pr-1 pl-3 text-xs shadow-xl",
              s.severity === "warn" ? "border-l-brand-orange" : "border-l-primary",
            )}
          >
            <div className="min-w-0 flex-1">
              <a
                href={`#${s.section}`}
                onClick={() => {
                  track("bottleneck_suggestion_clicked", { kind: kindOf(s.id), severity: s.severity });
                  if (onNarrow()) setMinimised(true);
                }}
                className="text-sm font-semibold leading-snug hover:underline"
              >
                {s.title}
              </a>
              {/* Clamped here; the linked section shows the full context. */}
              <p className="mt-0.5 line-clamp-2 break-words text-muted-foreground">{s.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(s.id)}
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Dismiss suggestion: ${s.title}`}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {open.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="surface min-h-8 self-end rounded-md px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Show fewer" : `${open.length - VISIBLE} more`}
        </button>
      )}
    </aside>
  );
}
