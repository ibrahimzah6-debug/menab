# Menab: System Architecture

Phase 04 · Draft v0.1 · Nov 3, 2026 · @IBRAHIM

The app is a web app on Supabase, with one AI layer that every generation passes through. That layer is what lets Kie.ai, fal.ai, or any later provider be swapped per task without touching the rest.

## At a glance

&#91;embedded content: system parts · one AI layer in front of all providers\]

Long AI jobs run in a background queue, so closing the page never loses a generation. Every result is copied to Menab's own storage before the user sees it, because Kie.ai keeps files for only about 14 days.

## Tech stack

**\[Recommendation\]** Common, well-documented tools that Claude Code builds with reliably, so the build is fast and anyone can maintain it later.

| Part | Tool | Why |
| --- | --- | --- |
| Web app | Next.js (React) with Tailwind | Fast to build, strong right-to-left and Arabic support, works on phones |
| Database, login, file storage | Supabase (Postgres) | One service for data, accounts, and media; row-level security keeps each workspace separate; already connected to this project |
| Background jobs | A job queue such as Trigger.dev or Inngest (chosen in build) | AI video takes minutes; jobs must survive page refreshes, retry, and wait for provider callbacks |
| Text AI (brief, script, treatment, documents) | Claude via the official Anthropic API | Core of the product; strong Arabic; official API is the most reliable |
| Image, video, music | Kie.ai main, fal.ai backup | Decided in Phase 01; confirmed by the test below |
| Voice | ElevenLabs (via fal.ai) or Kie.ai voice | Arabic voice quality to be tested |
| PDF and Excel exports | HTML templates turned into PDF; Excel built in code | Every document carries the workspace brand kit |
| Hosting | Vercel for the app; Supabase for data | Simple deploys from Claude Code |
| Payments (later) | A Saudi gateway with mada, Apple Pay, STC Pay: PayTabs, Tap, Moyasar, or HyperPay | Chosen when top-up is built |

**\[Confirmed fact\]** Supabase has no Middle East region. The nearest are Frankfurt and Mumbai. See the security section for what this means for ID numbers.

**\[Recommendation\] Live board view.** The AI layer sends small events as it works (card created, text added, image ready). The app receives them through Supabase Realtime and draws them on a canvas built with a ready-made library such as tldraw or React Flow, chosen in the build. The same events power the AI cursor animation, so live editing adds no extra AI cost.

## How one AI generation runs

&#91;embedded content: one generation · retry, backup, refund\]

Credits are held, not charged, when a job starts. The user pays the real cost only when a file is saved; a full failure releases the hold. Every job records its prompt, model, provider, cost, and retries, which also feeds the provider score sheet after launch.

## Model routing

Each task has a default model and a provider order, stored as settings rather than code, so a model or provider changes without a rebuild. Users can switch the model on any generation. All defaults below are **\[Assumption\]** until the test confirms them.

| Task | Default model | Main provider | Backup |
| --- | --- | --- | --- |
| Brief analysis, questions, strategy | Claude | Anthropic | Kie.ai (Claude) |
| Script, treatment, shot list, documents | Claude | Anthropic | Kie.ai (Claude) |
| Character sheets, locations, keyframes | Nano Banana 2 | Kie.ai | fal.ai |
| Storyboard frames | Nano Banana 2 (sketch or photo-real style) | Kie.ai | fal.ai |
| Video shots | Kling 3.0 or Seedance 2.5 (test decides) | Kie.ai | fal.ai |
| Premium video | Veo 3.1 | Kie.ai | Google (official) |
| Voiceover, Arabic and English | ElevenLabs | fal.ai | Kie.ai voice |
| Music | Suno | Kie.ai | none yet |
| Upscale, background removal | Best-priced model at test time | Kie.ai | fal.ai |

## Data

The main tables. Every table carries a workspace ID, so one company can never see another's data.

| Group | Tables | Holds |
| --- | --- | --- |
| Accounts | workspaces, members | Company, people, roles, spending limits |
| Projects | projects, stages, outputs, versions | The approval chain: each output's content, status, and full history |
| Content | sequences, scenes, shots | The content chain; each shot links its frame, keyframe, clip, and AI or shoot tag |
| Libraries | characters, locations, brand\_kits, assets | Reusable items; projects keep locked copies |
| AI | generation\_jobs, model\_settings | Every generation: prompt, model, provider, cost, status, retries, result file |
| Money | credit\_ledger | Every top-up and every charge, never edited, only added to |
| Production | crew, permits, schedules, call\_sheets | Crew with roles and GAMR registration; permit data |
| Review | comments, approvals, activity\_log | Who did what and when |
| Files | exports | Every PDF, Excel, and zip produced |

## Permissions and security

**Permissions** follow the roles in the Information Architecture. The database enforces them, not only the screens, so a bug in the app cannot leak one workspace's data to another.

**National ID and iqama numbers** (needed for crew lists and GAMR permits):

- Stored encrypted, in a separate field from the rest of the crew record.
- Shown masked (last 4 digits) except to Admins and Coordinators.
- Never sent to any AI model. The AI fills a permit with names and roles; the IDs are added when the PDF is built.
- Every view or export of an ID is logged.
- Optional in v1: the user can leave IDs out and add them by hand on the GAMR portal.

**Saudi data law (PDPL)** allows data to leave the Kingdom only with safeguards and kept to the minimum needed. Breaches must be reported to SDAIA within 72 hours, and most companies must register on SDAIA's platform.

**\[Recommendation\]**

- Internal testing: host in Supabase Frankfurt, with IDs optional as above.
- Before the public launch: get a short legal review. Decide whether ID numbers move to a Saudi-hosted service, while the rest stays where it is.

**Other basics:**

- Provider API keys stay on the server only.
- Media is opened through links that expire.
- Daily database backups.
- Two-step login for Admins.

## AI provider test

The test runs before the generation part is built. It takes 2 to 3 days and about $30 to $50 in credits. Claude Code runs a small script, so no app is needed.

**Setup:**

1. One real past brief from Ibrahim (a Ninja-style ad) becomes 10 test prompts: 2 characters, 2 locations, 3 keyframes, 3 video shots.
2. Every prompt runs on Kie.ai and fal.ai, plus the official API where we have access.
3. Each video model (Kling 3.0, Seedance 2.5, Veo 3.1 Fast) runs the same 3 shots.
4. Ibrahim adds his own Seedance 2.5 results from the Higgsfield free week for a quality comparison.

**Score sheet** (one row per provider and model, filled during the test):

| Provider | Model | Success rate (%) | Avg time (sec) | Real cost (USD) | Quality (1 to 5) | Character consistency (1 to 5) | Arabic text in image (1 to 5) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kie.ai | Nano Banana 2 |  |  |  |  |  |  |  |
| fal.ai | Nano Banana 2 |  |  |  |  |  |  |  |
| Kie.ai | Kling 3.0 |  |  |  |  |  |  |  |
| fal.ai | Kling 3.0 |  |  |  |  |  |  |  |
| Kie.ai | Seedance 2.5 |  |  |  |  |  |  |  |
| fal.ai | Seedance 2.5 |  |  |  |  |  |  |  |
| Kie.ai | Veo 3.1 Fast |  |  |  |  |  |  |  |
| Higgsfield (manual) | Seedance 2.5 |  |  |  |  |  |  |  |

**Pass rule:** a provider becomes the main one for a model if it succeeds on at least 95% of runs and scores no worse than 1 point below the best on quality. Below that, the next provider takes the slot.

Commercial-use terms for each provider are checked at the same time.

## Open points for Ibrahim

- [x] Name and domain: **Menab** (مِناب), menab.si. The company may receive payments through an account outside Saudi.
- [ ] Accounts to open when the test starts: Kie.ai, fal.ai, Anthropic API, Supabase, Vercel.
- [ ] Approve Frankfurt hosting for internal testing, with ID numbers optional.
- [ ] A legal review of PDPL before the public launch: who would do it?
