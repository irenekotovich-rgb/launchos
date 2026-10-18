# Bootstrap prompt
Unzip the package (a `launchos` folder appears in ~/Downloads), open Terminal,
run `claude`, paste EVERYTHING below the line into the chat. Answer the one
intake batch (you can paste keys and tokens right in the chat) — then the agent
runs everything itself.

---

BOOTSTRAP — set this machine up from the starter package, then build the project end-to-end.

The starter package is at ~/Downloads/launchos (unzipped). It contains: README.md,
CLAUDE.md, kickoff-prompt.md, START-HERE.md, BOOTSTRAP-PROMPT.md, docs/,
design-reference.html, .claude/settings.json, .gitignore, .env.example.

Do the following strictly in order:

1. MOVE: move the whole folder from ~/Downloads/launchos to ~/launchos (verify
   hidden files .claude/, .gitignore, .env.example arrived too; nothing stays in
   Downloads). Treat ~/launchos as the project root for everything below.

2. READ: read ~/launchos/CLAUDE.md, README.md, docs/PRD.md and kickoff-prompt.md.
   They define the product, scope, PR workflow, visual QA and attribution rules.
   Follow them for the rest of this project.

3. ENVIRONMENT CHECK: verify node (LTS), git, gh, vercel CLI; install whatever
   is missing yourself (brew/npm). Check git config user.name/user.email and
   `gh auth status`.

4. ONE COMBINED INTAKE: ask me ALL questions in ONE batch — merge your setup
   needs with Phase 0 of kickoff-prompt.md. I will answer everything right here
   in the chat, including secrets. Ask for:
   - git user.name / user.email to set (if not configured)
   - my GitHub username; confirm I've created an empty PUBLIC repo "launchos"
     (if not, tell me to create it at github.com/new and wait for my "done")
   - a GitHub personal access token (repo scope) if `gh auth status` is not
     green — authenticate with `gh auth login --with-token`
   - a Vercel token (vercel.com/account/tokens) if the CLI isn't linked —
     use it for all vercel commands
   - my API keys: Gemini (aistudio.google.com), OpenRouter, PostHog, Vercel Blob —
     you create .env.local from .env.example and write them in yourself
   - plus every Phase 0 question from kickoff-prompt.md (demo launch content,
     visual direction yes/no, any PRD changes)
   After I answer, also tell me to type /install-github-app here in this chat
   (the PR-review bot), and wait for my "done".

5. HYGIENE: after writing .env.local, confirm it is gitignored and never echo
   key values back in any later message, commit, log or PR.

6. FIRST COMMIT: git init; initial commit of docs only
   ("docs: PRD, positioning, launch plan, metrics before first line of code");
   add remote; push to main.

7. EXECUTE: run kickoff-prompt.md end-to-end (Milestones 1→4, fully hands-off:
   PRs with reviewer-grade descriptions, @claude reviews, respond to every
   comment, self-merge when green, visual QA screenshots before every UI PR,
   decisions-log updated, author credit everywhere). Do not ask me anything
   after the intake unless a credential is missing or a service is hard-down.
   If you hit a session limit, state exactly where you stopped; I'll type
   "continue" in a new session and you resume from docs/decisions-log.md and
   open branches.

Done = deployed on Vercel, README complete with GIF and BYO-key quickstart,
PostHog live, all PRs merged with reviews and responses.
