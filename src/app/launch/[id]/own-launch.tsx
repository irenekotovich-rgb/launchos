"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { runwayWarning } from "@/lib/plan";
import { loadLaunch, saveLaunch } from "@/lib/storage";
import { LaunchEditor } from "@/components/room/editors";
import { TrackOnMount } from "@/components/analytics";
import { LaunchRoom } from "@/components/room/launch-room";
import type { LaunchDoc } from "@/lib/types";

export function OwnLaunch({ id }: { id: string }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "missing" } | { status: "corrupt" } | { status: "ready"; doc: LaunchDoc }
  >({ status: "loading" });
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    setState({ status: "loading" });
    const result = loadLaunch(id);
    setState(result.status === "ok" ? { status: "ready", doc: result.doc } : { status: result.status });
  }, [id]);

  if (state.status === "loading") {
    return <p className="text-muted-foreground" aria-live="polite">Loading the launch room…</p>;
  }
  if (state.status === "corrupt") {
    return (
      <div role="alert" className="surface flex flex-col items-start gap-3 rounded-2xl p-6">
        <h1 className="text-2xl font-bold">This launch couldn&apos;t be read</h1>
        <p className="text-muted-foreground">
          The saved copy in this browser is damaged or from an incompatible version. Start a new brief, or open the demo.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/new" className={buttonVariants()}>Start a brief</Link>
          <Link href="/demo" className={buttonVariants({ variant: "outline" })}>Open the demo launch</Link>
        </div>
      </div>
    );
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
  const warning = runwayWarning(doc.tier.tier, doc.brief.targetDate, new Date(doc.meta.createdAt));
  return (
    <div className="flex flex-col gap-4">
      <TrackOnMount event="launch_room_viewed" props={{ mode: "own" }} />
      {saveError && (
        <div role="alert" className="sticky top-2 z-30 flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive shadow-lg">
          <p>Unsaved: the last change couldn&apos;t be stored in this browser (storage full or blocked). It will be lost on reload.</p>
          <button type="button" onClick={() => setSaveError(false)} className="shrink-0 font-semibold underline">Dismiss</button>
        </div>
      )}
      {warning && (
        <p role="note" className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">{warning}</p>
      )}
      <LaunchEditor
        doc={doc}
        onChange={(next) => {
          setState({ status: "ready", doc: next });
          setSaveError(!saveLaunch(next));
        }}
      >
        <LaunchRoom doc={doc} now={new Date()} basePath={`/launch/${id}`} editable />
      </LaunchEditor>

    </div>
  );
}
