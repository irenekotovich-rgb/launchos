import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AnalysisDetail } from "@/components/room/analysis-detail";
import { SharedBanner } from "@/components/room/launch-room";
import { ANALYSIS_KEYS } from "@/components/room/analysis-section";
import { SHARE_ID } from "@/lib/share";
import { getShare } from "@/lib/share-store";
import type { AnalysisKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared analysis — LaunchOS", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedAnalysis({ params }: { params: Promise<{ id: string; field: string }> }) {
  const { id, field } = await params;
  if (!SHARE_ID.test(id) || !ANALYSIS_KEYS.includes(field as AnalysisKey)) notFound();
  const doc = await getShare(id).catch(() => null);
  if (!doc) notFound();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-16 pt-2">
        <SharedBanner sharedAt={doc.meta.sharedAt} />
        <AnalysisDetail doc={doc} field={field as AnalysisKey} basePath={`/share/${id}`} />
      </main>
    </>
  );
}
