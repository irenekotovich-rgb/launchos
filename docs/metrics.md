# Metrics & experiment plan — LaunchOS v1

Tooling: PostHog free tier. The README shows this funnel measured on the app
itself — the methodology applied to its own product, in public.

## North star
**Launch-room activation:** share of visitors who reach a filled launch room
(the demo launch or their own generated one). No sign-ups exist, so an
unactivated visit is vanity.

## Metrics tree
| Level | Metric | Event | Target v1 |
|---|---|---|---|
| North star | Visitor → filled launch room | `launch_room_viewed` | ≥ 40% |
| Input | Hero CTA click | `hero_cta_click` | ≥ 55% |
| Input | Demo launch opened | `demo_opened` | ≥ 55% |
| Input | Own brief started | `brief_started` | ≥ 15% |
| Input | Brief → kit generated | `kit_generated` / `generation_started` | ≥ 60% |
| Input | Generation completes OK | `generation_completed` (prop `status`: live / unavailable / budget-exhausted) / `generation_started` | ≥ 97% live (fallback chain) |
| Depth | Consistency check run | `consistency_check_run` | ≥ 50% of kits |
| Depth | Launch room shared / JSON exported | `room_shared` | ≥ 10% |
| Depth | Analysis stage completed | `analysis_completed` | ≥ 30% of own launches |
| Depth | Problem & metrics alignment locked | `alignment_locked` | ≥ 25% of own launches |
| Depth | Rollout stage marked complete | `rollout_stage_completed` (prop `stage`: 10/30/60/100) | tracked, no target |
| Depth | Stage message opened for sending | `stage_notification_opened` | ≥ 80% of completed stages |
| Depth | Metrics dashboard viewed | `metrics_dashboard_viewed` | ≥ 30% of launch-room views |
| Depth | Bottleneck suggestion acted on | `bottleneck_suggestion_clicked` / `bottleneck_suggestion_shown` | ≥ 20% |
| Guardrail | Time to demo room | `launch_room_viewed` prop `ms_since_landing` | < 10 s |
| Proxy (forks) | GitHub stars/forks/clones | GitHub traffic | tracked, no target |

## Implementation notes
- PostHog with privacy defaults: no cookies (in-memory persistence), no autocapture, no session
  recording, Do-Not-Track respected, no personal data in properties; automated browsers are skipped.
- `launch_room_viewed` carries `mode` (demo / own / shared); `hero_cta_click` carries `cta`
  (demo / brief); `room_shared` carries `method` (link / export); suggestion events carry `kind`
  and `severity` only (no launch content).
- Event names are a closed union in `src/lib/analytics.ts`; a test fails if one isn't in this file.

## First experiments
1. **Hero framing A/B:** pain ("stop answering 'where are we?'") vs outcome
   ("your launch in one URL"). Decision metric: demo open rate.
2. **Demo-first vs brief-first landing.** Decision metric: activation.
3. **Checker placement:** consistency results inline per asset vs a separate
   report tab. Decision metric: consistency_check_run rate.
