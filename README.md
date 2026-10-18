# LaunchOS — your launch, in one URL

**Made by [Iryna Kotovych](https://www.linkedin.com/in/irynakotovych/) · Product Manager / Product Marketing**

LaunchOS is an open-source **launch room**: a single page that holds everything
about a product or feature launch — the analysis, the problem & metrics
agreement between teams, the brief, the launch tier, the timeline with gates
and ETAs, the readiness checklist, the staged rollout (10 → 30 → 60 → 100%),
the metrics dashboard, the full generated asset kit (release notes, blog,
email, LinkedIn post, sales one-pager, FAQ, sales deck + demo script, campaign
integration plan) and the decisions log.
One brief in → the whole kit out, and a consistency checker flags any asset
that drifts from the brief.

Why it exists: launch details always end up scattered across ten docs, decks and
Slack threads. Stakeholders ping the PMM for status; assets quietly contradict
each other. LaunchOS gives everyone one read-only URL instead.

**Try it:** open the hosted demo (no sign-up) — or clone this repo, add your own
API key, and run your real launches privately on your own tokens (BYO-key).

## What's where and why

| Path | What it is | Why it matters |
|---|---|---|
| `README.md` | This file — the map | First thing a visitor (or hiring manager) reads |
| `CLAUDE.md` | Working rules for Claude Code sessions: stack, PR workflow, visual QA, honesty rules, attribution | The project is built by directing AI agents; this file is how they're directed |
| `docs/PRD.md` | Product requirements: problem, users, jobs-to-be-done, v1 scope, key decisions, risks | Written **before** the first line of code — product thinking first |
| `docs/positioning.md` | Dunford-style canvas + message hierarchy for LaunchOS itself | A launch tool must be sharply positioned; also an honest note on competitors |
| `docs/launch-plan.md` | The plan for launching LaunchOS (tiers, phases, checklist, channels) | The tool plans its own launch — methodology eating its own dog food |
| `docs/metrics.md` | North star (launch-room activation), metrics tree, first A/B experiments | Defines "working"; the README will show this funnel measured on the app itself |
| `docs/decisions-log.md` | Dated one-liners for every judgment call made during the build | The paper trail of autonomous agent work — and the owner's pre-interview cheat sheet |
| `kickoff-prompt.md` | The prompts that drive the build: one intake interview, then milestones M1–M4 hands-off | Reproducibility: anyone can see exactly how this was built |
| `.claude/settings.json` | Pre-approved permissions for Claude Code | Lets agents install, commit, open and merge PRs without interrupting the owner |
| `.env.example` | Template for API keys (Gemini, OpenRouter, PostHog) | BYO-key: copy to `.env.local`, fill in, never committed |
| *(created in M1+)* `src/`, `prompts/`, `qa-shots/` | App code; versioned LLM prompts incl. the consistency rubric; visual QA screenshots | Prompts are product artifacts, not code internals; QA shots prove every screen was looked at |

## How this was built
With [Claude Code](https://claude.com/claude-code): the owner wrote the docs and
the kickoff prompts, answered one intake interview, and the agents built the app
through 10–15 small PRs — each with a reviewer-grade description, an automated
code review, responses, and visual QA screenshots. The full story: see the PR
history and `docs/decisions-log.md`.

## Run it with your own keys (BYO-key)
```bash
git clone <this repo> && cd launchos
cp .env.example .env.local   # fill in your keys — see "Environment variables" below
npm install && npm run dev
```
Your launches, your tokens, your data — nothing leaves your deployment.

## Environment variables
All optional — without model keys the app still works and shows a graceful "generation unavailable" state.

| Variable | Used for |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Primary model (Gemini) |
| `OPENROUTER_API_KEY` | Fallback models (OpenRouter free tier) |
| `LAUNCHOS_PRIMARY_MODEL` / `LAUNCHOS_FALLBACK_MODELS` | Override model ids (comma-separated fallbacks) |
| `BLOB_READ_WRITE_TOKEN` | Share links + daily budget counter (Vercel Blob); in-memory without it |
| `LAUNCHOS_DAILY_LIVE_RUNS` | Daily live-generation cap (default 25, `0` = unlimited) |
| `LAUNCHOS_RUNS_PER_CLIENT_HOUR` | Per-client hourly cap (default 3, `0` = off) |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | Product analytics (PostHog) — events from docs/metrics.md; wiring lands with the launch milestone (M4) |
| `LAUNCHOS_QA` | `1` enables the demo's `?now=` time override in production builds, for visual QA only |

### Limits on a public deployment
The daily cap and per-client throttle are soft guards for a free-tier showcase: the daily
counter is a non-atomic read-modify-write in Blob (concurrent requests can overshoot by a few
runs), and per-client limits live in memory per server instance. Per-client identity comes from
`x-vercel-forwarded-for` on Vercel; when self-hosting behind another proxy, make sure it
overwrites `x-real-ip` / `x-forwarded-for`, or the per-client limit can be spoofed.

## Visual QA
```bash
npx playwright install chromium   # once
npm run build && LAUNCHOS_QA=1 npm start
npm run qa:visual                 # every route at 390 / 768 / 1440 into /qa-shots
npm run qa:long-inputs            # 60-char name, 300-char claim; generation stubbed
npm run qa:edit-flow | qa:rollout-flow | qa:share-flow | qa:sections | qa:viewport
npm run qa:consistency            # QA_STUB_CONSISTENCY=1 to use a fixture
npm run qa:live-generate          # one LIVE generation (uses your keys and budget)
```
All scripts honour `BASE_URL` (default http://localhost:3000).

## License
MIT © 2026 Iryna Kotovych
