# Build decisions

Decisions made during the build, with the reason. Product decisions stay in product-foundation.md.

## B1. Job queue: Inngest (M0)

CLAUDE.md asks to pick Trigger.dev or Inngest in M0. We pick **Inngest**.

- It installs from the Vercel marketplace in a few clicks and sets its own keys in Vercel, so there is no extra secret to copy by hand.
- The jobs run inside the Menab app on Vercel, so there is one codebase and one deploy.
- Each step of a job retries on its own, and a job can wait for a provider's callback (`waitForEvent`) without using server time. That fits the AI layer: hold credits, call Kie.ai, retry once, switch to fal.ai, save the file, then charge.
- Trigger.dev would also work. It is stronger for single tasks that run for many minutes on its own servers, but our long waits are for provider callbacks, which Inngest handles without that.

Inngest is installed when the AI layer is built (M1 provider test and M5), not in M0, because M0 has no AI jobs.

## B2. Invites by link, not email (M0)

Supabase's built-in email only sends to members of the Supabase organization, and is limited to a few emails an hour. So the Admin creates a one-time invite link on the Team page and sends it on WhatsApp or email. A custom sender on menab.si can be added later if Ibrahim wants invite emails.

## B3. Hosting regions (M0)

Supabase in Frankfurt (eu-central-1), approved by Ibrahim on 3 Nov 2026 for internal testing. Vercel functions run in Frankfurt too (`vercel.json`), so the app sits next to its database.

## Noted for later (from Ibrahim's M0 test, 4 Nov 2026)

- **Menu layout:** move the logo, workspace name, language switch and log out into the side menu, like Claude or ChatGPT, on the computer and on the phone, instead of the top bar. Do it when the remaining screens (login, home and projects) are designed. Not urgent; building comes first.

## B4. Dark only, compact (Ibrahim, 4 Nov 2026)

The app uses the Dark theme from `design-system/tokens.css` everywhere; the Light theme is not used for now. Text, cards and buttons are one step smaller than in the first screens (overrides at the end of `src/app/globals.css`). The side menu holds the logo, workspace, New project, the areas, and at the bottom the account, language and log out, like Claude. The orange accent rule is unchanged.

## B5. Provider test stopped, build first (Ibrahim, 4 Nov 2026)

Round 1 showed Kie.ai works end to end: jobs start, finish, files are saved to our storage and real costs are read back. Kling 3.0 made all clips. To save money, testing stops here and models are judged inside the real app as projects run. The test page stays under Settings for later rounds.

## B6. Ranked model lists (Ibrahim, 4 Nov 2026)

Each media task offers a short ranked list: 10 image models, 10 video models, 3 voice models, each with what it is good for and its starting price on Kie.ai. Number 1 is the top-rated. Lists live in `src/lib/ai/catalog.ts`; the Admin picks each task's default in Settings (`model_settings` table). Ranks start from public reputation and move with our own results.

## B7. The brain and voice briefs (M2)

- Claude (`claude-opus-5-5`, Anthropic API, structured outputs) reads the brief chat, fills the brief fields, asks at most 3 questions for required fields, suggests the path with a reason, and writes the stage 1 documents. Refusal fallback is on (`server-side-fallback-2026-07-01`, `fallbacks: "default"`).
- Voice notes are recorded in the browser, saved to our storage, and turned into text by Gemini 3.8 Flash through Kie.ai (Ibrahim's choice), then read by Claude.
- Every AI call is logged in `ai_jobs` with tokens and real cost; a failed call is logged at $0.
- Required brief fields before documents: client, goal, length, formats, language, deadline. Budget is optional.

## B8. Design revision after the M2 review (Ibrahim, 5 Nov 2026)

Replaces B4.
- **Colors:** each person picks Light, Dark or System in Settings → Appearance. Light is the default. Original sizes are back.
- **Frame:** one side menu on every screen, including inside projects. It opens and closes like Claude's (remembered per browser). Top: logo, workspace switcher (the up and down arrows icon), New project (the one orange button), the areas. Bottom: person, language, log out.
- **Stage screen:** back to the first design: stages on top, Page and Board on the top right, steps on the left with their status and a spinner while generating, the open step in the middle, the brief or the assistant on the right, approve bar at the bottom.
- **Board view:** the stage's steps as cards on the dotted canvas; clicking a card opens it in Page view. The live AI cursor comes with M4.
- **Model on the step:** the assistant panel has the ranked model picker with the price; the choice is remembered for the project (`projects.models`). Settings keeps each workspace's default, including a ranked writing model list (Claude Opus 5.5, Sonnet 5.5, Haiku 5.5).
- **Brief panel:** starts from the video (the idea in one line, the story beats, feeling, key message, must show), then delivery, production, and client and timing. Fields came from the Brief screen design and the Workflow Map, not from a real ZAH brief; to be checked against one when available.
- **Voice briefs:** Google's Gemini API on the free tier with Menab's own key (`GEMINI_API_KEY`, optional `GEMINI_MODEL`), Kie.ai as backup. Ibrahim accepted that Google may use free-tier content to improve its models.
