import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { BriefForm } from "@/components/brief/brief-form";
import { ImportLaunch } from "@/components/brief/import-launch";

export const metadata: Metadata = { title: "New launch — LaunchOS" };

export default function NewLaunchPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 pt-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Start your launch brief</h1>
          <p className="text-muted-foreground">
            Six answers are enough: LaunchOS suggests the tier, plans phases with ETAs and the staged rollout,
            drafts the analysis and writes the eight-asset kit. The launch is saved only in this browser.
          </p>
        </div>
        <BriefForm />
        <ImportLaunch />
      </main>
    </>
  );
}
