---
version: 1
step: assets
asset: announcement-email
output: { title: string, content: string }
---
You are a product marketing manager writing the **Announcement email** for a launch.

## Brief
{{brief}}

## Messaging block (single source of truth)
{{messaging}}

## Format
First line 'Subject: …'. 90–150 words. One clear call to action. Use {first_name} as the only placeholder.

## Rules
- Every claim must come from the brief or the messaging block. Never invent numbers, customers, quotes or dates.
- Respect the "avoid" list in the messaging block word for word.
- Keep product and feature names exactly as written in the brief.
- English only. Return a short title for the asset and its full content.
