# Decisions log — one dated line per autonomous judgment call

- 2026-10-18 — Intake: "remove 5 languages" read as removing all localization residue (markets, ES/UK items in design-reference.html; "languages" v2 bet in launch-plan.md). English-only made a PRD key decision, not a roadmap item.
- 2026-10-18 — Owner asked for ≤2 extra alignment teams beyond stakeholders/R&D/marketing/sales: chose Customer Support (first to see failure signals) and Legal/Compliance (claims and pricing).
- 2026-10-18 — Stage-complete messages to stakeholders + team leads: v1 composes the message and opens a prefilled mailto (copy fallback) instead of sending via an email service — keeps BYO-key setup to zero extra accounts and stores no addresses server-side. Auto-send listed as v2.
- 2026-10-18 — Rollout increments fixed at 10/20/30/40 (cumulative 10/30/60/100%) per owner; each stage gated on agreed metrics vs thresholds, override only with a logged decision.
- 2026-10-18 — Metrics dashboard values: manual entry + CSV import in v1; live analytics connectors moved to v2 (replaces the old "analytics on launch performance" out-of-scope line).
- 2026-10-18 — Bottlenecks shown as small dismissible "suggestion" popups (overdue gate, unsigned alignment, stale asset, metric past failure threshold, stale metric reading) — never blocking modals.
- 2026-10-18 — Visual direction changed from dark mission-control to grey metallic → lilac gradient with lilac + orange accents; design-reference.html kept as a layout-only prototype. Owner design review scheduled after M3.
- 2026-10-18 — Demo launch product name: "Launch Service" (fictional), per owner.
- 2026-10-18 — START-HERE.md (Ukrainian owner notes) and linkedin-article-draft.md (unpublished draft) gitignored: the repo is English-only and public.
- 2026-10-18 — Secrets flow: keys live in Vercel project env vars and reach .env.local via `vercel env pull` — the agent never writes .env* directly (project deny rule kept intact).
- 2026-10-18 — Vercel Blob store `launchos-share` created as **private**: share links are served by an API route that reads the doc server-side, so blobs are never publicly addressable.
- 2026-10-18 — `/install-github-app` is unavailable in the VS Code extension: review bot set up manually (Claude GitHub App + `.github/workflows/claude.yml` + repo secret).
