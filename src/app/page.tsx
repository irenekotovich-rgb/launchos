import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STAGES = [
  { name: "Analysis", detail: "Context, environment, competitors, economics, capacity, audience." },
  { name: "Alignment", detail: "One problem, success and failure metrics, signed off by six teams." },
  { name: "Brief & assets", detail: "Six assets from one brief, checked for drift against it." },
  { name: "Readiness", detail: "A gate with evidence, not a feeling." },
  { name: "Staged rollout", detail: "10% → 30% → 60% → 100%, each stage gated on agreed metrics." },
  { name: "Metrics", detail: "The numbers everyone agreed on, per stage, against thresholds." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-14 px-4 pb-16 pt-8 sm:pt-16">
        <section className="flex max-w-3xl flex-col gap-6">
          <h1 className="text-gradient text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Your launch, in one URL.
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            One brief in: analysis, team alignment, plan with ETAs, a staged rollout and the whole asset kit
            out. Stakeholders get a read-only link instead of a status meeting.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/demo" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-base")}>
              Open the demo launch <ArrowRight />
            </Link>
            <Link href="/new" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5 text-base")}>
              Start your brief
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Free and open source. No sign-up. Run it on your own keys for real launches.
          </p>
        </section>

        <section aria-labelledby="how" className="flex flex-col gap-4">
          <h2 id="how" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            How a launch moves
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((stage, i) => (
              <li key={stage.name} className="surface rounded-xl p-5">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-semibold">{stage.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{stage.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
