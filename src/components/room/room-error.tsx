"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Error boundary body: a malformed launch or a storage outage never shows a crash screen. */
export function RoomError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const outage = error.message.includes("temporarily unavailable");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-2xl font-bold">{outage ? "Shared launches are temporarily unavailable" : "This launch couldn't be displayed"}</h1>
      <p className="text-muted-foreground">
        {outage
          ? "The link wasn't deleted — storage didn't answer. Try again in a minute."
          : "Part of the launch data is malformed (for example an edited or imported file). The demo still works."}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className={buttonVariants()}>Try again</button>
        <Link href="/demo" className={buttonVariants({ variant: "outline" })}>Open the demo launch</Link>
      </div>
    </main>
  );
}
