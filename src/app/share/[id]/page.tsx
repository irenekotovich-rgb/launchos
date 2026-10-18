import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LaunchRoom } from "@/components/room/launch-room";
import { fmtDayYear } from "@/lib/format";
import { SHARE_ID } from "@/lib/share";
import { getShare } from "@/lib/share-store";

export const dynamic = "force-dynamic";

// Share links are private-by-obscurity: never index them.
export const metadata: Metadata = { title: "Shared launch room — LaunchOS", robots: { index: false, follow: false } };

export default async function SharedLaunch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHARE_ID.test(id)) notFound();
  const doc = await getShare(id).catch(() => null);
  if (!doc) notFound();
  const now = new Date();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-28 pt-2">
        <div role="note" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <p>
            <span className="font-semibold text-primary">Read-only snapshot</span>
            {doc.meta.sharedAt && <> shared {fmtDayYear(doc.meta.sharedAt)}</>}. Recipient emails and sign-off names are removed.
          </p>
          <Link href="/new" className="font-semibold underline underline-offset-4">Run your own launch</Link>
        </div>
        <LaunchRoom doc={doc} now={now} />
      </main>
    </>
  );
}
