# LaunchOS

Open-source "launch room": one URL that holds everything about a product/feature
launch — brief, tier, timeline, readiness gate, generated asset kit, decisions
log — and keeps the assets consistent with the brief. English-only product.
Built by a PMM with Claude Code; the product docs in /docs are first-class
citizens of this repo.

## What matters here
- /docs is the source of truth: PRD.md, positioning.md, launch-plan.md,
  metrics.md. If implementation contradicts a doc, update the doc in the same
  commit — never let them drift silently. (Drift control is literally what this
  product does; the repo must practice it.)
- Honesty is a feature: demo content labeled on every screen; every generated
  asset marked "draft — review before publishing"; model ids + date recorded in
  the launch doc. Never fake content to make a screen look better.
- This is a public work sample read by hiring managers: clear naming, English
  everywhere, no secrets, no placeholder lorem ipsum on any committed screen.
- **Author attribution is a hard requirement.** Every page renders the shared
  <AuthorCredit /> footer: "Made by Iryna Kotovych" linking to
  https://www.linkedin.com/in/irynakotovych/ (rel="author"). Also in: README
  header, LICENSE copyright line, package.json `author`, exported launch-doc
  JSON (`author` field), OG image byline. Never remove it when restyling.

## Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, deployed on Vercel Hobby
- AI via Vercel AI SDK; primary: Gemini free tier; fallback chain: primary →
  OpenRouter cheap model → graceful "generation unavailable" state (never an
  error screen); daily live-run budget guard in lib/budget.ts
- Data model: one launch = one portable `LaunchDoc` JSON. No database in v1;
  export/import locally; share links = read-only doc under an unguessable id
  (Vercel Blob)
- Distribution: hosted instance = demo showcase (sample launch + capped live
  generations); real use = self-hosted fork with the user's own keys (BYO-key).
  Every feature must work in a fresh clone with only .env.local filled in
- PostHog (free tier) with events exactly as named in docs/metrics.md

## Commands
- `npm run dev` — local dev
- `npm run build && npm run lint && npm test` — must pass before every commit (CI also runs `tsc`)
- `npm run qa:visual` — Playwright screenshots of all routes at 390/768/1440 px
  into /qa-shots (see Visual QA below)

## Git & PR workflow — the repo must show how the work was run
No direct pushes to main after the initial docs commit. For every logical task:
1. Branch `feat/<task>` (or `fix/`, `docs/`, `chore/`)
2. Small conventional commits, each buildable
3. Open a PR with `gh pr create`: body = what & why, mapping to docs/PRD.md,
   what was deliberately left out, how it was tested. For UI PRs: attach the
   visual QA screenshots
4. Request the automated review (@claude via the GitHub app); respond to every
   comment in the thread — fix or argue, don't ignore. The thread must show
   review + responses
5. Merge yourself with `gh pr merge --squash` once review is addressed and
   build+lint+visual QA are green. Do NOT wait for the owner — this project
   runs hands-off end-to-end. Unresolvable review points go to
   docs/decisions-log.md
Target: 10–15 PRs across the project, each readable in under 5 minutes.

## Dependency security updates
Dependabot alerts and security updates are on. Its PRs are not merged blindly:
- CI (lint, tsc, tests, build — required check `checks` on main) must be green;
- the lockfile diff should touch only the advised package and its dependents; skim its changelog,
  be wary of major bumps;
- request `@claude` review, answer it, merge like any PR (its `dependabot/…` branch names are fine);
- CI red → comment `@dependabot rebase`; still red → fix on the branch or close it and log why.

## Visual QA — mandatory before any UI PR
- Run the app, screenshot every changed screen at 390 / 768 / 1440 px
  (Playwright), and actually LOOK at the images: text overflow, clipped labels,
  overlapping elements, unreadable contrast, broken wrapping on long inputs
  (test with a 60-char product name and a 300-char claim)
- Fix what you see before opening the PR; attach before/after screenshots
- Dark surfaces: verify text ≥ 4.5:1 contrast for body, ≥ 3:1 for large text
- Empty, loading and error states exist for every screen — no blank divs

## Design checkpoint with the owner
Visual direction (owner's reference, 2026-10-18): Apple-style bento on a
near-black stage — chrome-silver metal lettering, burgundy-metal tiles, glow
warming into burgundy; wine-rose primary, orange only for attention. Minimal
text, maximum visualisation and facts; one long page. The design checkpoint
with the owner happened after M3; build to this direction from here on.

## Conventions
- Conventional commits; small commits, each buildable
- All model prompts in /prompts as versioned .md files — never inline in code;
  the consistency-check rubric is a prompt file (prompts/consistency-rubric.md)
- Keys only via .env.local / Vercel env vars; .env* gitignored
- Keep docs/decisions-log.md: every judgment call made autonomously, one dated
  line each

## Model policy for Claude Code sessions
- Default session mode: opusplan (Opus plans, Sonnet executes)
- No subagents needed — the work is linear now that video is out of scope
