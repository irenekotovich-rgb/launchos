import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "How I built this — LaunchOS",
  description: "A PMM directing Claude Code agents: docs first, one intake, small reviewed PRs, visual QA on every screen.",
};

const REPO = "https://github.com/irenekotovich-rgb/launchos";

const STEPS = [
  { title: "Docs before code", body: "PRD, positioning, launch plan and metrics were the first commit. Every later change that touched behaviour updated the docs in the same PR." },
  { title: "One intake, then hands-off", body: "One batch of questions at the start (keys, demo content, visual direction, scope changes). After that the agents ran milestones without asking — except one planned design checkpoint." },
  { title: "Small PRs, every one reviewed", body: "Branch → reviewer-grade description → automated @claude review → fix or argue every point in the thread → squash merge. Nothing pushed to main after the initial docs commit; every PR from #2 on (#1 installed the reviewer) has the review and the replies." },
  { title: "Visual QA on every UI change", body: "Playwright screenshots at 390 / 768 / 1440 px, long-input runs (60-char name, 300-char claim), and the images actually looked at before opening the PR." },
  { title: "A design checkpoint", body: "Once the product worked end to end, the owner supplied a visual reference (chrome + burgundy metal) and product changes; those shipped as their own reviewed PRs." },
  { title: "Live runs and an audit", body: "Generation and the consistency check were verified against real models, and a whole-repository audit closed dependency, privacy and drift issues before launch." },
];

const SPLIT = {
  pmm: [
    "Problem, audience, jobs-to-be-done and scope (PRD)",
    "Positioning, launch plan and the metrics tree",
    "Product calls at intake: staged rollout 10/30/60/100, alignment teams, success vs failure metrics",
    "Visual direction and the design checkpoint feedback",
    "What counts as honest: drafts labelled, demo labelled, nothing invented",
  ],
  agents: [
    "All application code, prompts and tests",
    "PR descriptions, responses to every review comment",
    "Visual QA screenshots and the fixes they prompted",
    "Judgment calls inside the PM's guardrails — each one logged in docs/decisions-log.md",
    "Deploy, analytics wiring and the repository audit",
  ],
};

const CAUGHT = [
  { text: "A UI library had installed an unrelated npm package named “cn” — flagged by the reviewer on the scaffold PR.", pr: 2 },
  { text: "The exported launch file carried the share link's delete token — fixed before merge.", pr: 11 },
  { text: "Whitespace in an env var turned the public demo's daily budget into “unlimited”.", pr: 17 },
  { text: "Analytics would have sent share-link ids (which are credentials) inside page URLs.", pr: 18 },
  { text: "Gemini's free lite models reject the `maxItems` schema keyword — found only by running the check live.", pr: 17 },
];

export default function HowPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-16 pt-6">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">How I built this</p>
          <h1 className="text-chrome pb-[0.1em] text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            A PMM directing agents, in public.
          </h1>
          <p className="max-w-3xl text-lg text-muted-foreground">
            LaunchOS was built with Claude Code. I wrote the product docs and made the product calls; AI agents wrote the code
            through small pull requests, each reviewed by an automated reviewer and answered point by point. The whole trail is
            public — the code is not presented as hand-written.
          </p>
        </header>

        <section aria-labelledby="process" className="flex flex-col gap-3">
          <h2 id="process" className="text-chrome text-2xl font-extrabold">The process</h2>
          <ol className="grid gap-3 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <li key={s.title} className={i === 2 ? "surface-burgundy rounded-3xl p-6" : "surface rounded-3xl p-6"}>
                <p className={i === 2 ? "font-mono text-sm text-white" : "text-chrome font-mono text-sm font-bold"}>{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className={i === 2 ? "mt-1 text-white" : "mt-1 text-muted-foreground"}>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="split" className="grid gap-3 md:grid-cols-2">
          <h2 id="split" className="sr-only">Who did what</h2>
          <div className="surface rounded-3xl p-6">
            <h3 className="text-lg font-bold">What the PMM decided</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {SPLIT.pmm.map((l) => (
                <li key={l} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />{l}</li>
              ))}
            </ul>
          </div>
          <div className="surface rounded-3xl p-6">
            <h3 className="text-lg font-bold">What the agents did</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {SPLIT.agents.map((l) => (
                <li key={l} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />{l}</li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="caught" className="surface rounded-3xl p-6">
          <h2 id="caught" className="text-chrome text-2xl font-extrabold">What review and QA caught</h2>
          <p className="mt-1 text-muted-foreground">A few real examples — each is a merged pull request with the conversation attached.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {CAUGHT.map((c) => (
              <li key={c.text} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-orange" aria-hidden />
                <span>
                  {c.text.replace("`maxItems`", "maxItems")}{" "}
                  <a href={`${REPO}/pull/${c.pr}`} className="font-semibold text-primary underline-offset-4 hover:underline" target="_blank" rel="noopener">
                    PR #{c.pr} ↗
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-wrap gap-3">
          <a href={`${REPO}/pulls?q=is%3Apr+is%3Amerged`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/60" target="_blank" rel="noopener">
            All merged pull requests ↗
          </a>
          <a href={`${REPO}/blob/main/docs/decisions-log.md`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/60" target="_blank" rel="noopener">
            Decisions log ↗
          </a>
          <a href={`${REPO}/blob/main/docs/PRD.md`} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/60" target="_blank" rel="noopener">
            PRD ↗
          </a>
          <Link href="/demo" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open the demo launch</Link>
        </section>
      </main>
    </>
  );
}
