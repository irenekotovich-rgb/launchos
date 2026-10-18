# Kickoff prompt — paste into Claude Code, session 1

Read CLAUDE.md, README.md and docs/PRD.md first — they define the product,
scope and working rules. English-only product.

## Phase 0 — ONE intake, then zero interruptions
Ask me ALL questions in ONE batch now; after I answer, run the ENTIRE project
(Milestones 1→4) end-to-end without asking me anything again. I will not review
PRs, answer design questions, or merge — you own all of it. Only interrupt me if
a credential is missing or an external service is hard-down. Ask at minimum:
- GitHub repo URL; is `gh auth status` green; is the @claude review app installed
- Which API keys are in .env.local (Gemini? OpenRouter? PostHog?)
- Demo launch content: fictional B2B SaaS launch (answered: "Launch Service")
- Visual direction (answered: no — grey metallic → lilac gradient, lilac + orange
  accents; owner gives references once the product works end-to-end)
- Vercel: is the account linked (`vercel whoami`)? If not, hand me `vercel login`
  once during intake — the only interactive step you may give me
- Any changes to docs/PRD.md before scope locks

## Phase 0.5 — environment self-setup (no questions, just do it)
Check and install whatever is missing yourself: node LTS, `gh` (brew), `vercel`
CLI, project deps, Playwright for visual QA. Verify `gh auth status`, repo
remote, and that .env.local has the keys named at intake. Missing tool →
install it; missing auth → the one thing you stop and ask for.

## Working mode — fully hands-off
- Git & PR workflow per CLAUDE.md: branch per task → small commits →
  `gh pr create` with a reviewer-grade description → request @claude review →
  respond to every comment (fix or argue) → `gh pr merge --squash` when green.
  Never push to main directly. ~10–15 PRs total, each readable in 5 minutes.
- **Visual QA before every UI PR** (CLAUDE.md "Visual QA"): screenshot every
  changed screen at 390/768/1440, look at the images, fix overflow / clipped
  text / contrast, attach screenshots to the PR. Test long inputs (60-char
  product name, 300-char claim).
- Keep docs/decisions-log.md: every judgment call, one dated line.
- Author credit per CLAUDE.md on every page, in LICENSE, package.json, README,
  exported JSON, OG images.
- If a session hits a usage limit: say exactly where you stopped; I'll type
  "continue" in a new session — resume from the log and open branches.

## Milestone 1 — walking skeleton on mocked data
Suggested PR split: `chore/scaffold`, `feat/launchdoc-types-and-demo-data`,
`feat/landing-and-brief-form`, `feat/launch-room-page`, `feat/author-credit-and-chrome`.
1. Next.js (App Router, TS, Tailwind, shadcn/ui). Grey metallic surfaces with a
   gradient into lilac; accents lilac + orange (owner's direction at intake).
   design-reference.html shows layout only (countdown, timeline, readiness
   ring), not colors. Owner gives final visual references once the product
   works end-to-end; no generic AI-template aesthetics.
2. `LaunchDoc` type in lib/types.ts: brief (what/who/why-now/date/claims), tier
   + rationale, analysis (context, environment, competitors, economics,
   capacity, audience), alignment (problem, for whom, success + failure
   metrics with thresholds/owners, team sign-offs), timeline phases with gates
   + ETAs, rollout stages (10/30/60/100% with gates, metric readings,
   recipients, notification status), checklist items, assets[] (type,
   status: generating|draft|stale|ok, content), consistency findings[],
   decisions[], meta (models, dates, author).
3. Demo launch at data/demo-launch.json — fictional B2B SaaS feature launch,
   fully filled, labeled `"mode": "demo"`; visible "demo" badge.
4. Pages: landing (hero + "Open the demo launch" + "Start your brief");
   brief form; launch room (project overview with stage, ETAs, end date and
   countdown + bottleneck suggestion popups; analysis; alignment; timeline +
   gate + checklist; staged rollout; metrics dashboard; asset cards; decisions
   log; consistency panel placeholder). `runGeneration(brief): Promise<LaunchDoc>`
   mocked in lib/pipeline.ts behind the real interface.
5. Build+lint green; responsive at 390px; empty/loading/error states; visual QA
   pass with screenshots in the PRs.

## Milestone 2 — real generation pipeline
- prompts/: brief-to-tier.md, asset templates (6), consistency-rubric.md —
  versioned files, never inline
- Implement runGeneration: tier suggestion with rationale → timeline/checklist
  derivation → 6 assets generated from the same brief+messaging block
- Fallback chain per CLAUDE.md + lib/budget.ts daily cap → graceful demo state
- Record model ids + date in the LaunchDoc; every asset marked
  "draft — review before publishing"

## Milestone 3 — the twist: consistency & the single source of truth
- Consistency checker: each asset compared to the brief on the fixed rubric
  (claims, numbers, named features); findings rendered per asset; stale-flag
  assets when the brief is edited after generation
- Decisions log UI (add/edit dated one-liners)
- Staged rollout interactions: complete a stage → compose stage message →
  open prefilled mailto to stakeholders + team leads; 100% flag
- Metrics dashboard: manual entry + CSV import, thresholds, breach →
  bottleneck suggestion
- Export/import LaunchDoc JSON; read-only share link via Vercel Blob under an
  unguessable id, with delete; "anyone with the link" warning

## Milestone 4 — ship it
- Deploy to Vercel Hobby; verify demo works with API keys revoked
- PostHog events exactly as named in docs/metrics.md
- OG images with byline; `npm run qa:visual` script committed
- README: extend the existing one with GIF, architecture sketch, Decisions and
  Limitations sections; "Run it with your own keys" quickstart tested on a
  fresh clone
- MIT LICENSE "Copyright (c) 2026 Iryna Kotovych"; package.json author
- "How I built this" page: Claude Code workflow, the PR process, what the PMM
  decided vs what the agents did

Done = deployed, README complete, PostHog live, all PRs merged with reviews and
responses, decisions log full, visual QA shots in /qa-shots.
