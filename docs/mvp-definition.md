# Menab: MVP Definition

Phase 06 · Draft v0.1 · Nov 3, 2026 · @IBRAHIM

Menab v1 is the internal version ZAH uses on real projects. It takes a 30 second commercial from brief to approved shots and production paperwork, on the AI, production, or hybrid path, in Arabic and English. It is built in 8 milestones, each one tested at ZAH before the next starts.

## What v1 includes

Output numbers refer to the [Workflow Map](https://claude.ai/artifact/7znRgQTfC8JbqGqaKCqjVh).

| Area | In v1 | Later |
| --- | --- | --- |
| Accounts | Login, one workspace per company, 4 roles, Arabic and English with right-to-left | Client and production-house logins (Stage 2) |
| Brief (1 to 6) | Chat and voice brief, missing-info questions, brief summary, strategy, path suggestion, first CPS | None |
| Creative (7 to 12) | Directions, meeting notes, AV script, treatment, visual mood, approval | None |
| Look and characters (13 to 18) | Characters, wardrobe, locations, art direction, storyboard (sketch or photo-real), shot list | Animatic (19) |
| Pre-production (20 to 32) | Budget, crew list with GAMR registration, permit data, equipment, PPM booklet, PPM sign-off, shooting schedule, call sheets | Award (21), casting (23), scouting (24), recce (29), fittings (30), pre-light (33) |
| Generate (34 to 38) | Reference lock, keyframes, video shots, voice, shot review, model switch, editable prompts | Music generation in the app |
| Shoot (34 to 38) | None | Shoot day, continuity, rushes, daily report, selects |
| Edit (39 to 49) | None; shots are exported | Built-in editor in v2, AI effects in v3 |
| Deliver (50 to 55) | Export (PDF, Excel, zip), rights record, archive, optional GAMR approval step | Cutdowns and QC tools (v2) |
| Views | Page view; Board view with the live AI cursor (watch and open cards) | Dragging and arranging cards on the board |
| Money | Balance, cost before every action, credits held then charged, full ledger | Self top-up by card, Apple Pay, mada (ZAH tops up by hand in v1) |
| Templates | Commercial (30 sec) with presets: Ramadan ad, product launch, event recap | Film, podcast, documentary, photography |
| Website | Landing page with the walkthrough | Public sign-up |

## Build milestones

&#91;embedded content: build milestones · M0 to M7, one gate each\]

Milestones run in order. M1 runs alongside M2 to M4 so the provider choice is settled before M5 starts. No dates yet; each milestone closes when its gate passes, and the full criteria are in the table above.

## What done means

A feature is done only when a ZAH team member can do the following without help, in Arabic and in English.

| Milestone | Feature | Done when |
| --- | --- | --- |
| M0 | Login and roles | An Admin invites a Coordinator; the Coordinator logs in and sees only ZAH's workspace |
| M0 | Language | Switching to Arabic flips the whole screen to right-to-left with no broken layout |
| M2 | Voice brief | A 1 minute Arabic voice note becomes a written brief in under 30 seconds |
| M2 | Missing info | The AI asks only for fields that are empty, never more than 3 questions at a time |
| M2 | Path suggestion | Each brief gets AI, production, or hybrid with a one-line reason, and the user can switch |
| M3 | Script | A 30 sec AV script fits within 2 seconds of the chosen length, with Saudi-dialect VO |
| M3 | Versions | Every edit or regeneration keeps the old version, and any version can be restored |
| M3 | Stage approval | One click approves the stage and unlocks the next; approved work cannot change without a new version |
| M4 | Storyboard | Every shot in the shot list has a frame, in sketch or photo-real style as chosen |
| M4 | Board view | While the AI writes, cards appear and fill live with the Menab AI cursor; clicking a card opens it |
| M5 | Cost before action | Every generate button shows the price before it runs |
| M5 | Retry and backup | A failed generation retries, then moves to the backup provider, and the user is never charged for a failure |
| M5 | Consistency | The same character looks like the same person across all shots of a test project, judged by the ZAH team |
| M6 | Crew list | Each crew member shows GAMR registration status; ID numbers are masked except for Admins and Coordinators |
| M6 | Paperwork | CPS, PPM booklet and call sheet PDFs contain every field in the Workflow Map's document table, in ZAH's brand kit |
| M7 | Export | Approved shots download as a zip, documents as PDF, budget and shot list as Excel |
| M7 | Rights record | Every exported asset lists its model, provider, prompt and approver |

## Starter brief for Claude Code

Paste this as the first message in Claude Code, or save it as `CLAUDE.md` in the new repository. Claude Code cannot open these links directly; export each doc as Markdown from its Share menu and put them in a `docs/` folder first.

```markdown
# Menab

Menab (مِناب) takes a video from brief to delivery through AI generation, a production house, or both. Arabic and English, Saudi first. Domain: menab.si.

## Source of truth (in docs/)
- product-foundation.md: vision, users, decisions D1 to D20
- workflow-map.md: the 55 outputs, stages, document fields, Saudi rules
- information-architecture.md: navigation, stage screen, Page and Board view, roles
- system-architecture.md: stack, AI layer, routing, data, security, provider test
- mvp-definition.md: v1 scope, milestones M0 to M7, done criteria
- design-system/: tokens.json, tokens.css, components/bundle.css, README.md
- screens/: the four designed screens

## Stack
Next.js and Tailwind on Vercel, Supabase for data, login and storage with row-level security per workspace, a job queue for AI work, Claude via the Anthropic API for text, Kie.ai for media with automatic fallback to fal.ai.

## Rules
- Build one milestone at a time. Stop at the end of each and list what to test.
- Use the design system tokens only. Black, white and gray; the accent appears on at most one call to action per screen. Status is never shown by color.
- Rubik for all text, JetBrains Mono for labels. Every screen works right to left.
- Interface copy is plain and human. No em dashes anywhere. Buttons start with a verb.
- Every AI call goes through the AI layer: show the cost first, hold credits, retry, fall back, save the result to our storage, then charge.
- National ID and iqama numbers are encrypted, masked in the interface and never sent to an AI model.
- Never add a feature the docs do not list. Ask when something is unclear.

## Start
Begin with M0: repository, Supabase project, login, workspace and roles, the Arabic and English shell with the stage screen layout.
```

## Still needed before or during the build

| Item | From | Needed by |
| --- | --- | --- |
| Accounts: Anthropic API, Supabase, Vercel, GitHub | Ibrahim | M0 |
| Approval to host data in Frankfurt (no Middle East region yet) | Ibrahim | M0 |
| Kie.ai and fal.ai accounts with a small top up | Ibrahim | M1 |
| One past ZAH brief for the provider test | Ibrahim | M1 |
| Logo as SVG, plus the Arabic wordmark | Ibrahim | M0 shell, final by M7 |
| Budget template, or approval to build one from a public reference in ZAH design | Ibrahim | M6 |
| Who does the PDPL legal review | Ibrahim | Before any outside user |
| Remaining screens: login, home and projects, pre-production stage, exports | Claude (design chat) | Before the milestone that uses each one |
| Saudi payment gateway choice | Later | After the internal launch |
