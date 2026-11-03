# Menab

Menab (مِناب) takes a video from brief to delivery through AI generation, a production house, or both. Arabic and English, Saudi first. Domain: menab.si. First users: the ZAH Production Services team in Riyadh.

The owner is Ibrahim. He is not a developer. Explain each step in plain words, one step at a time, and wait for him when a step needs him (signing up, pasting a key, approving a cost).

## Source of truth

Read these before writing any code. If the code and the docs disagree, the docs win. If the docs are unclear, ask.

- `docs/product-foundation.md`: vision, users, decisions D1 to D20
- `docs/workflow-map.md`: the 55 outputs, the stages, what each document must contain, Saudi rules
- `docs/information-architecture.md`: navigation, the stage screen, Page and Board view, roles
- `docs/system-architecture.md`: stack, AI layer, model routing, data tables, security, provider test
- `docs/mvp-definition.md`: v1 scope, milestones M0 to M7, what "done" means
- `docs/competitor-analysis.md`: background only
- `design-system/`: `tokens.json`, `tokens.css`, `components/bundle.css`, `README.md` (brand book), logos in `assets/Logos/`
- `screens/`: PNG of each designed screen, plus the HTML source in `screens/html/`

The diagrams in the docs were dropped in the Markdown export and show as "embedded content" placeholders. The text around each one explains it.

## Stack

- Next.js (App Router) and Tailwind, hosted on Vercel
- Supabase: Postgres, auth, storage, Realtime. Row-level security on every table, scoped by workspace. Region: Frankfurt (eu-central-1)
- Job queue for AI work: Trigger.dev or Inngest (pick one in M0 and say why)
- Text AI: Claude through the Anthropic API
- Media AI: Kie.ai main, fal.ai backup, behind one AI layer

## Rules

- Build one milestone at a time. At the end of each, stop and give Ibrahim a short list of what to test.
- Use the design system tokens only. Black, white and gray; the orange accent appears on at most one call to action per screen. Status is never shown by color alone.
- Rubik for all text, JetBrains Mono for uppercase labels. Every screen works right to left in Arabic.
- Interface copy is plain and human. No em dashes anywhere. Buttons start with a verb.
- Every AI call goes through the AI layer: show the cost first, hold credits, retry once, fall back to the backup provider, save the file to our own storage, then charge the real cost. A full failure costs nothing.
- National ID and iqama numbers are encrypted, masked in the interface and never sent to an AI model.
- Secrets live in `.env.local` and in Vercel settings, never in the code, the repo, or the chat.
- Desktop first. Build for a computer screen. On a phone, only these need to work: review and approve, comments, voice brief or voice note, today's call sheet, credit balance, and notices. See Devices in docs/information-architecture.md. No native mobile app.
- Before showing Ibrahim any screen, open it with Playwright, take a screenshot, and compare it with the matching PNG in screens/. Fix what does not match first.
- Never add a feature the docs do not list. Ask when something is unclear.

## Start

Milestone M0: install the official Supabase agent skill (`npx skills add supabase/agent-skills`), then accounts and keys, repository, Supabase project, login, workspace and roles, and the Arabic and English shell with the stage screen layout.
