# Prompts

Every model prompt LaunchOS uses lives here as a versioned Markdown file — never inline in code
(CLAUDE.md). Code loads a prompt by file name and fills `{{placeholders}}`.

- Frontmatter: `version` (bump on any wording change), `step` (pipeline step), `output` (what the
  model must return). The version is recorded in the LaunchDoc next to the model id.
- Shared context: `{{brief}}` is the brief rendered as plain text; `{{messaging}}` is the messaging
  block produced by `brief-to-tier.md`. Every asset starts from the same two blocks, so assets can't
  start inconsistent.

| File | Step | Returns |
|---|---|---|
| `brief-to-tier.md` | tier | tier, rationale, messaging block |
| `analysis-draft.md` | analysis | six analysis fields (AI drafts) |
| `asset-release-notes.md` … `asset-faq.md` | assets | one asset each |
