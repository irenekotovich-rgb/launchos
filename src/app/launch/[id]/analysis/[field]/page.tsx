import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ANALYSIS_KEYS } from "@/components/room/analysis-section";
import type { AnalysisKey } from "@/lib/types";
import { OwnAnalysis } from "./own-analysis";

export const metadata: Metadata = { title: "Analysis — LaunchOS", robots: { index: false, follow: false } };

export default async function OwnAnalysisPage({ params }: { params: Promise<{ id: string; field: string }> }) {
  const { id, field } = await params;
  if (!ANALYSIS_KEYS.includes(field as AnalysisKey)) notFound();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-16 pt-2">
        <OwnAnalysis id={id} field={field as AnalysisKey} />
      </main>
    </>
  );
}
