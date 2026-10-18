"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { prepareImport } from "@/lib/edit";
import { saveLaunch } from "@/lib/storage";

/** Import a LaunchDoc JSON (exported from LaunchOS) as a new launch in this browser. */
export function ImportLaunch() {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-semibold">
        Or import a launch file <span className="font-normal text-muted-foreground">(.json exported from LaunchOS)</span>
      </label>
      <input
        id={id}
        type="file"
        accept="application/json,.json"
        className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground"
        onChange={async (e) => {
          setError(null);
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 2_000_000) return setError("That file is too large to be a launch.");
          let raw: unknown;
          try {
            raw = JSON.parse(await file.text());
          } catch {
            return setError("That file isn't valid JSON.");
          }
          const newId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}`;
          const doc = prepareImport(raw, newId, new Date());
          if (!doc) return setError("That file isn't a LaunchOS launch (or it's from an incompatible version).");
          if (!saveLaunch(doc)) return setError("Couldn't save in this browser — storage may be blocked.");
          router.push(`/launch/${doc.meta.id}`);
        }}
      />
      <p role="alert" className="text-destructive empty:hidden">{error ?? ""}</p>
    </div>
  );
}
