import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { LaunchRoom, SharedBanner } from "@/components/room/launch-room";
import { SHARE_ID } from "@/lib/share";
import { getShare } from "@/lib/share-store";

export const dynamic = "force-dynamic";

// Share links are private-by-obscurity: never index them.
// The id is the credential: never index, never leak it via Referer to links inside the room.
export const metadata: Metadata = {
  title: "Shared launch room — LaunchOS",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedLaunch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!SHARE_ID.test(id)) notFound();
  let doc;
  try {
    doc = await getShare(id);
  } catch (err) {
    console.error("[share] read failed", err);
    // A storage outage is not "deleted": say so instead of rendering not-found.
    throw new Error("Shared launches are temporarily unavailable.");
  }
  if (!doc) notFound();
  const now = new Date();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-28 pt-2">
        <SharedBanner sharedAt={doc.meta.sharedAt} />
        <LaunchRoom doc={doc} now={now} basePath={`/share/${id}`} />
      </main>
    </>
  );
}
