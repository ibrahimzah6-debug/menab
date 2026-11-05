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

## B9. Editing, instructions, languages, free model (Ibrahim, 5 Nov 2026)

- **Edit any document:** Edit opens the document's own fields; saving makes a new version and keeps the old one. The idea and story beats can be edited on the brief panel.
- **Tell Menab what to change:** an instruction box in the assistant panel (Page and Board view) revises the documents from one sentence, for example "make it the father rushing to the supermarket", with the cost shown first.
- **Language menu:** a globe button at the bottom of the side menu, like Google's, with the code beside each language. English and Arabic are complete. Amharic, Urdu, Hindi, Indonesian, Turkish, French, Spanish, German, Portuguese, Russian and Chinese are listed as coming soon. The MVP keeps "additional languages" for later; they are added when the interface settles, so each new screen is not translated 13 times while it is still changing.
- **Account menu:** the person's name opens Settings and Log out, to keep the side menu clear.
- **Free writing model:** Gemini 3.8 Flash on Google's free tier is in the writing list, marked "Free, daily limit". Google's free tier covers writing only; image (Nano Banana) and video (Veo) models are paid, so they cannot be offered free. One key's free limit is shared by every Menab user, and Google may use free-tier content, so it suits trying things out, not client work.
- **Smart prompts (planned for M4 and M5):** image and video prompts are not copied from a script line. Menab AI writes each shot's prompt from the whole approved concept: the treatment, visual mood, locked character and location references (with names and descriptions), wardrobe, the shot's size, lens, camera move, light and time of day, the action in order, and what must stay consistent. The person sees and can edit the prompt and the shot options before anything is generated, with the cost shown.

## B10. Backup AI, owner dashboard, quiet composer, languages (Ibrahim, 5 Nov 2026)

- **Automatic backup for writing:** every AI call is tried, retried once, then sent to the other provider: Claude falls back to Gemini 3.8 Flash, Gemini falls back to Claude Sonnet 5.5. The job log records which model answered (`ai_jobs.fallback_from`), and a notice is created (`notifications`).
- **Owner dashboard** (`/owner`, people in `platform_admins` only): AI calls, cost, failures and backups for the last 30 days, a table by model, every notice, and each workspace with its people, projects and AI cost.
- **Credits page:** each workspace sees its own AI spend by project and by model. Balance and top-up come with credits in M5.
- **Composer like Claude's:** "+" adds files (images and PDFs, sent to the model with the message and saved to our storage), and on the right the model, the microphone and a send arrow. Prices sit in the model list and the buttons' tooltips. Connectors and skills under "+" are not in the docs yet; to discuss.
- **Inline editing:** document text and the idea are edited where they are, by clicking; leaving the field saves a new version.
- **Loading:** the Menab mark's three parts light up in turn while Menab AI works; the "Menab AI" label on replies is gone.
- **Top bar:** "Spent" sits in a box, with the globe language button beside it.
- **All 13 languages now:** English and Arabic are written by hand. Amharic, Urdu, Hindi, Indonesian, Turkish, French, Spanish, German, Portuguese, Russian and Chinese are translated from English by Gemini the first time anyone picks them, stored in `translations`, and redone automatically when the English text changes. Urdu is right to left.

## B11. Writing through Kie.ai only, quieter voice, fixed reply box (Ibrahim, 5 Nov 2026)

- **No direct Anthropic account:** every writing model runs through Kie.ai (Claude through `api.kie.ai/claude/v1/messages`, Gemini through Kie's Gemini endpoint). Google's free Gemini key stays for voice and the free writing option. The list: Claude Fable 5, Claude Opus 5.5 (default), Claude Sonnet 5.5, Gemini 4 Argon, Claude Haiku 5.5, Gemini 3.8 Flash (free). Backup rule unchanged: retry once, then the other family.
- **Voice:** always Gemini, no model choice and no seconds counter. The browser records a small WAV file (Gemini does not accept the browser's default WebM), uploads it straight to our storage, and the text lands in the reply box first. The person reads it and decides to send.
- **Uploads:** files and voice notes go from the browser to storage with a one-time upload link, so their size never passes through the app server (which caps each request near 1 MB).
- **"+" menu:** Photos, Files (PDF), and Connectors marked Soon.
- **Stage screen:** one fixed height on a computer. The reply box stays at the bottom, only the messages scroll, and the steps and the right panel scroll on their own.
- **Side menu:** closed by default. On a phone a thin top bar opens it over the page.
- **Board:** the main line of each card (the idea, the summary's opening, the key message, the reason for the path) is edited on the card. "Open page" opens the full step.
- **Loading:** a single dot that grows and fades, like Claude and ChatGPT.
- **Languages:** the interface is translated in small parts, three at a time, each tried twice, so a first switch no longer fails on one long answer.

## B12. OpenAI models, live steps, reliable voice, board canvas (Ibrahim, 5 Nov 2026)

- **Writing models:** Gemini leaves the writing list; OpenAI joins through Kie.ai (`api.kie.ai/codex/v1/responses`). Strongest first: Claude Fable 5, GPT 6 Astra, Claude Opus 5.5 (default), GPT 6.1 Sol, Claude Sonnet 5.5, GPT 6.1 Terra, Claude Haiku 5.5, GPT 6 Luna. Backup: Claude falls back to GPT 6.1 Sol, GPT falls back to Claude Sonnet 5.5. A project still set to a Gemini model uses the default.
- **Answers that are slightly off** (a list sent as text, a number as words, an empty field left out) are put into shape before they are checked. The retry tells the model what was wrong.
- **Time limits:** each model call stops after 70 seconds (90 for the stage documents), so a stuck model moves on to the retry and the backup instead of hanging. The page allows 5 minutes in total.
- **Live steps:** the chat shows what Menab is doing as it happens, like Claude and ChatGPT: reading the message and files, asking the model, retrying, switching to the backup, which brief fields changed, the suggested path, saving. A dropped connection puts the message back in the box; it never breaks the page.
- **Voice:** Gemini 3.8 Flash through Kie.ai first (paid, a fraction of a cent, reliable), tried twice; Google's free tier is the last backup. The free tier answered "high demand" to every voice note.
- **Board:** a canvas. Drag empty space to move, scroll to pan, zoom with the buttons or Ctrl and the wheel.
- **Strategy and deliverables:** tone, length, ratio and platform are dropdowns with "Other…" to type your own; platforms are chips you switch on and off.

## B13. Libraries, templates, settings, workspaces, ready languages (Ibrahim, 6 Nov 2026)

- **Libraries** (information-architecture.md, system-architecture.md): brand kits (logo, colors, fonts, tone, notes), characters (photos, age, who they are, look, wardrobe, voice), locations (photos, city, real or AI, notes) and files (logos, product photos, references, music, footage, documents). Tables `brand_kits`, `characters`, `locations`, `assets`, RLS per workspace. Files go straight to the private `media` bucket under `<workspace>/library/`. Locking a copy into a project comes with M4 (Look and characters).
- **Templates** (mvp-definition.md): Commercial with three ready setups: Ramadan ad, product launch, event recap. Starting one creates a project with the brief already holding length, cutdowns, formats and objective, and an opening message from Menab AI. Document templates are listed with the stage that writes them.
- **Settings** in sections, like Claude: Account (photo, name, password), Workspace, Appearance, Language (all 13), AI models, Notifications, Usage, Get help. The menu under the person's name: Settings, Usage, Language, Get help, Log out. Profile photo in `members.avatar_path`.
- **New workspace:** owners (platform admins) add a workspace from the switcher and join it as Admin. One workspace per company stays the rule.
- **Languages ready ahead:** after each page view, two missing languages are translated in the background (Gemini through Kie.ai), so picking any language switches at once. Google's free tier had refused every translation.
- **Board zoom** scales the layout as it is; the columns no longer change.
- **Stage screen with the menu open:** the steps and the right panel get narrower and their text smaller; the middle keeps its room.
- **Voice:** transcription runs with thinking turned off, to answer faster.
