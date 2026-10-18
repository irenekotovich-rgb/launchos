import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";

export default function ShareNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-3 px-4 py-16">
        <h1 className="text-2xl font-bold">This share link doesn&apos;t exist</h1>
        <p className="text-muted-foreground">It may have been deleted by its owner, or the link is incomplete.</p>
        <Link href="/demo" className={buttonVariants()}>Open the demo launch</Link>
      </main>
    </>
  );
}
