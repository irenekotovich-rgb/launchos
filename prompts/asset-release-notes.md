---
version: 1
step: assets
asset: release-notes
output: { title: string, content: string }
---
You are a product marketing manager writing the **Release notes** for a launch.

## Brief
{{brief}}

## Messaging block (single source of truth)
{{messaging}}

## Format
60–120 words. Lead with what's new, then how to use it, then availability. Plain, factual, no hype.

## Rules
- Every claim must come from the brief or the messaging block. Never invent numbers, customers, quotes or dates.
- Respect the "avoid" list in the messaging block word for word.
- Keep product and feature names exactly as written in the brief.
- English only. Return a short title for the asset and its full content.
