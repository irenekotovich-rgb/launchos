# PRD — LaunchOS v1: one launch, one URL

Owner: PMM · Status: approved for build · Living document · English-only product

## 1. Problem
Everything about a product/feature launch lives in ten places: the brief in one
doc, the timeline in a spreadsheet, assets in five drafts, status in Slack
threads, decisions in people's heads. Stakeholders ping the PMM for the current
state; assets drift from the brief as it changes; the same kit gets rebuilt from
scratch every launch. There is no single place that answers "what is this
launch, where is it, and are we ready?"

## 2. Who it's for
- **Primary:** PMM / PM running feature and product launches in B2B SaaS,
  20–500 employees — owns the launch, has no launch-ops team.
- **Secondary:** founders doing their first structured launch.

## 3. Jobs to be done
1. When I plan a launch, I want one URL with the brief, plan, status and every
   asset, so stakeholders stop asking me "where are we?"
2. When the brief changes, I want every affected asset flagged stale, so claims
   never drift between the blog, the email and the sales one-pager.
3. When leadership asks "are we ready?", I want a readiness gate with evidence,
   so go/no-go is a checklist, not a feeling.
4. When the launch kit is needed, I want it generated from the brief in minutes,
   so my time goes into judgment, not formatting.

5. When a launch starts, I want the analysis and the problem/metrics agreement
   done before any asset exists, so every team argues about the same numbers.
6. When we roll out, I want staged exposure with a go/no-go per stage, so a bad
   launch hurts 10% of users, not 100%.

## 4. Scope v1
**In:**
- **Stage 1 — Analysis:** context, environment, competitors, economics,
  company capacity for this launch, target audience. Structured fields, each
  with an optional AI draft from the brief (draft — review before publishing)
- **Stage 2 — Problem & metrics alignment:** which problem it solves and for
  whom; success metrics and failure metrics (each with threshold + owner);
  sign-off by stakeholders, R&D, marketing, sales and two suggested extra
  teams — **Customer Support** (sees failure signals first) and **Legal /
  Compliance** (claims and pricing). Locked alignment feeds every later step
- Launch brief form: what ships, for whom, why now, target date, key claims
- Tier suggestion (T1/T2/T3) with written rationale, overridable
- Timeline with phase gates derived from tier and date
- Readiness checklist auto-derived from tier; manual check-off with notes
- Asset kit generated from the brief: release notes, blog post, announcement
  email, LinkedIn post, sales one-pager, FAQ
- **Cross-asset consistency check:** claims, numbers and terminology compared
  across all assets against the brief; drift flagged per asset
- Decisions log: dated one-liners, part of the launch doc
- **Project overview:** the whole launch at a glance — current stage, ETA per
  stage, projected end date, live countdown to launch day. Possible
  bottlenecks (overdue gate, unsigned alignment, stale asset, metric breaching
  a failure threshold) surface as small dismissible **suggestion** popups,
  never blocking modals
- **Staged rollout:** 10% → +20% (30%) → +30% (60%) → +40% (100%) of the
  audience. Each stage has its own gate (metrics vs. thresholds) and ends with
  a stage-complete message to the stakeholder group and every involved team
  lead. The 100% stage opens on launch day itself; it flags the launch
  "rolled out to 100%"
- **Metrics dashboard:** the success/failure metrics agreed in Stage 2,
  charted per rollout stage against their thresholds. v1 values are entered
  manually or imported as CSV (no analytics integration)
- The launch room is a shareable read-only URL — the single source of truth
- Demo mode: one polished prebuilt sample launch ("Launch Service",
  fictional), no sign-up, no API calls
**Out (v2+):** video asset; Slack/Jira integrations; live analytics
connectors (PostHog/Amplitude) feeding the dashboard; automatic email sending
(v1 composes the stage message and opens it prefilled for the recipient list);
multi-user accounts & permissions; multi-launch portfolio views.

## 5. Key decisions
| Decision | Choice & why |
|---|---|
| Distribution | **Open source + bring your own key.** Hosted app = demo showcase (sample launch + tightly capped live generations). Real use = clone, add your own API keys, your tokens, your data. No accounts, no stored customer data; the GitHub repo is the acquisition channel. |
| Data model | One launch = one portable JSON document (`LaunchDoc`). No database in v1: export/import JSON locally; share links store the doc under an unguessable id (Vercel Blob) read-only. |
| Generation | All assets generated from the same brief + messaging block, so they can't start inconsistent. Prompts live in /prompts as versioned files. |
| Consistency check | LLM compares each asset against the brief on a fixed rubric (claims, numbers, named features, tone red-flags) and returns per-asset findings. Same rubric every run → comparable. |
| Model resilience | Ordered fallback chain: primary model → cheap fallback (OpenRouter) → clear "generation unavailable, demo shown" state. A visitor's demo must never die on a rate limit. Guards: per-client hourly throttle + soft daily cap of live runs (counter in Blob, fails closed if storage breaks; runs that produce nothing are refunded); every request finishes under a fixed deadline with typed JSON. A partial kit ships when single assets fail. |
| Language | **English only.** No localization, no market/language variants in the product, prompts or demo. Not on the roadmap. |
| Rollout | Fixed 10/20/30/40 increments (cumulative 10/30/60/100%). A stage can't open until the previous stage's gate passes or is overridden with a logged decision. |
| Notifications | Recipients = stakeholder group + team leads, stored in the LaunchDoc. v1 generates the message and opens it via `mailto:` with copy fallback — no email service. Addresses live only in the LaunchDoc on the owner's device; read-only share links strip recipients and sign-off names before upload. |
| Visual direction | Grey metallic surfaces with a gradient into lilac; accents lilac and orange. Final references collected from the owner once the product works end-to-end. |
| Honesty | Demo content labeled on every screen; generated assets marked "draft — review before publishing"; model ids + date recorded in the doc. |

## 6. Risks
- **Looks like a template, not a tool** → the consistency checker and the live
  gate are the interactive proof; demo opens on them.
- **Share links leak internal plans** → unguessable ids, explicit "anyone with
  the link" warning, delete button; demo uses fictional product only.
- **Scope creep toward GTM platforms** (Ignition et al. own that space) → v1
  stays single-launch, single-user, English-only; see docs/positioning.md.
- **Analysis and alignment feel like homework** → every field is optional
  except problem + success/failure metrics; AI drafts the rest from the brief.
- **Manual metric entry goes stale** → each stage gate shows the "last
  updated" date, and an old value raises a bottleneck suggestion.

## 7. Success criteria
See docs/metrics.md — north star: a visitor reaches a filled launch room
(demo or own), not sign-ups.
