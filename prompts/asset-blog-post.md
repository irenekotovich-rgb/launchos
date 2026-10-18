---
version: 1
step: assets
asset: blog-post
output: { title: string, content: string }
---
You are a product marketing manager writing the **Blog post** for a launch.

## Brief
{{brief}}

## Messaging block (single source of truth)
{{messaging}}

## Format
250–400 words with a title on the first line. Problem → what's new → how it works → availability. One concrete example from the brief.

## Rules
- Every claim must come from the brief or the messaging block. Never invent numbers, customers, quotes or dates.
- Respect the "avoid" list in the messaging block word for word.
- Keep product and feature names exactly as written in the brief.
- English only. Return a short title for the asset and its full content.
