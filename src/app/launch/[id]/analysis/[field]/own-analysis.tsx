"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisDetail } from "@/components/room/analysis-detail";
import { LaunchEditor } from "@/components/room/editors";
import { buttonVariants } from "@/components/ui/button";
import { loadLaunch, saveLaunch } from "@/lib/storage";
import type { AnalysisKey, LaunchDoc } from "@/lib/types";

export function OwnAnalysis({ id, field }: { id: string; field: AnalysisKey }) {
  const [doc, setDoc] = useState<LaunchDoc | null | "loading">("loading");
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    const res = loadLaunch(id);
    setDoc(res.status === "ok" ? res.doc : null);
  }, [id]);
  if (doc === "loading") return <p className="text-muted-foreground" aria-live="polite">Loading…</p>;
  if (!doc) {
    return (
      <div className="surface flex flex-col items-start gap-3 rounded-3xl p-6">
        <h1 className="text-2xl font-bold">This launch isn&apos;t in this browser</h1>
        <Link href="/demo" className={buttonVariants()}>Open the demo launch</Link>
      </div>
    );
  }
  return (
    <>
      {saveError && <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive">Unsaved: storage is full or blocked.</p>}
      <LaunchEditor
        doc={doc}
        onChange={(next) => {
          setDoc(next);
          setSaveError(!saveLaunch(next));
        }}
      >
        <AnalysisDetail doc={doc} field={field} basePath={`/launch/${id}`} editable />
      </LaunchEditor>
    </>
  );
}
