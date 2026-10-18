"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { loadLaunch } from "@/lib/storage";
import type { LaunchDoc } from "@/lib/types";

const fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export function OwnLaunch({ id }: { id: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "missing" } | { status: "ready"; doc: LaunchDoc }>({
    status: "loading",
  });

  useEffect(() => {
    const doc = loadLaunch(id);
    setState(doc ? { status: "ready", doc } : { status: "missing" });
  }, [id]);

  if (state.status === "loading") {
    return <p className="text-muted-foreground" aria-live="polite">Loading the launch room…</p>;
  }
  if (state.status === "missing") {
    return (
      <div className="surface flex flex-col items-start gap-3 rounded-2xl p-6">
        <h1 className="text-2xl font-bold">This launch isn&apos;t in this browser</h1>
        <p className="text-muted-foreground">
          Own launches are stored locally on the device that created them. Open the demo, or start a new brief.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo" className={buttonVariants()}>Open the demo launch</Link>
          <Link href="/new" className={buttonVariants({ variant: "outline" })}>Start a brief</Link>
        </div>
      </div>
    );
  }

  const { doc } = state;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Launch day {fmt.format(new Date(doc.brief.targetDate))}</p>
        <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{doc.brief.productName}</h1>
      </div>
      <section className="surface rounded-2xl p-5">
        <h2 className="font-semibold">
          Suggested tier <span className="text-primary">{doc.tier.tier}</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{doc.tier.rationale}</p>
      </section>
      <section className="surface rounded-2xl p-5">
        <h2 className="font-semibold">Plan</h2>
        <ol className="mt-3 flex flex-col gap-2">
          {doc.phases.map((p) => (
            <li key={p.key} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-border pb-2 text-sm last:border-0">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">ETA {fmt.format(new Date(p.eta))}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
