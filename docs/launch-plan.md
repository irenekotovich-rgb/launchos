# Launch plan — LaunchOS v1 (yes, LaunchOS plans its own launch here)

Tier: T2 (new product, solo maker, no pricing) · Runway: 2 weeks

## Phases
| When | What | Exit criteria |
|---|---|---|
| T−14 → T−8 | Private beta: 10 PMMs run a real upcoming launch through it | ≥7 reach a filled launch room; top-3 confusion points fixed |
| T−7 → T−1 | Content: demo GIF, worked example (fictional launch), LinkedIn article draft | assets pass the "would I share this?" bar |
| T−0 | LinkedIn article + Product Hunt; personal notes to PMM communities | live; demo verified with API keys revoked |
| T+7 | Retro: PostHog funnel review; decide v2 bet (analytics connectors vs Slack/Jira integrations) | decision written down with data |

## Channels
- **Owned:** LinkedIn profile (the launch is itself a PMM work sample); GitHub
  README with GIF — the repo is a landing page.
- **Borrowed:** Product Hunt; PMM/product communities; launch/GTM newsletters.

## Launch-day checklist (excerpt)
- [ ] Demo launch room works end-to-end with API keys revoked
- [ ] Fallback chain verified (primary → fallback → graceful demo state)
- [ ] "Run it with your own keys" quickstart tested on a fresh clone, clean machine
- [ ] Visual QA pass on all screens at 390 / 768 / 1440 px — no overflow, no
      clipped text, contrast readable (screenshots attached to the release PR)
- [ ] Share links render OG previews on LinkedIn and Slack
- [ ] Every generated asset carries "draft — review before publishing"

## LinkedIn article & tagging policy
- Tag the tools used (Claude by Anthropic, Vercel, PostHog) — devrel teams
  reshare maker stories; that reach converts.
- Do NOT tag target employers — a public tag reads as a cold pitch. Instead:
  run their next launch brief through LaunchOS (public info only), export the
  room, send it personally to the hiring manager. The product is the outreach.
- Never claim "first/only": GTM platforms exist (see positioning.md) — claim
  the segment: open-source, single-player, free.
