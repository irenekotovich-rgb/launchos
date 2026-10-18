import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { OwnLaunch } from "./own-launch";

export const metadata: Metadata = { title: "Launch room — LaunchOS" };

export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pb-28 pt-2">
        <OwnLaunch id={id} />
      </main>
    </>
  );
}
