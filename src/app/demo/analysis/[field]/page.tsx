import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AnalysisDetail } from "@/components/room/analysis-detail";
import { ANALYSIS_KEYS, ANALYSIS_LABELS } from "@/components/room/analysis-section";
import { DemoBanner } from "@/components/room/launch-room";
import { getDemoLaunch } from "@/lib/demo";
import type { AnalysisKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ field: string }> }): Promise<Metadata> {
  const { field } = await params;
  const label = ANALYSIS_LABELS[field as AnalysisKey];
  return { title: label ? `${label} — demo analysis — LaunchOS` : "LaunchOS" };
}

export default async function DemoAnalysis({ params }: { params: Promise<{ field: string }> }) {
  const { field } = await params;
  if (!ANALYSIS_KEYS.includes(field as AnalysisKey)) notFound();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-16 pt-2">
        <DemoBanner />
        <AnalysisDetail doc={getDemoLaunch()} field={field as AnalysisKey} basePath="/demo" />
      </main>
    </>
  );
}
