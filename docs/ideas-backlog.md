# Ideas and open questions

Ideas that come up while testing. None of these are in scope until Ibrahim decides. Each one gets a decision: now, later (with a milestone or version), or no. When an idea is decided, it moves into the right doc and the decision log.

| # | Idea or question | From | Status | Notes |
| --- | --- | --- | --- | --- |
| I1 | Side menu holds the logo, workspace, language switch and log out, like Claude or ChatGPT, on computer and phone | Ibrahim, M0 test, 4 Nov | Built (M2) | Dark side menu with account, language and log out at the bottom |
| I2 | Quick tools: one-off jobs without a full project, such as adding a logo to a video, a quick treatment from one paragraph, upscale, background removal | Ibrahim, 4 Nov | Open | Overlaps with the v2 editor and v3 AI effects. Reuses the AI layer and credits. Proposed for v2 |
| I3 | Ranked model list per task: 10 image, 10 video, 3 voice, each with price. Users never see the full provider catalog | Ibrahim, 4 Nov | Built (M2) | `src/lib/ai/catalog.ts`, default per workspace in Settings. See decisions-build.md B6 |
| I4 | Model lists per project type (UGC, commercial, and so on) | Ibrahim, 4 Nov | Later | v1 has the Commercial template only. Each new template brings its own short list, for example talking-avatar and lip-sync models for UGC |
| I5 | Who pays for file storage | Ibrahim, 4 Nov | Open, decide before public launch | Internal testing: Menab pays (Supabase Pro, $25 a month, 100 GB of files). Options for later: keep approved files, delete unapproved drafts after a set time with a warning, a storage allowance per workspace |
| I6 | How Menab improves over time | Ibrahim, 4 Nov | Open | Proposal: measure how often each output is edited or regenerated before approval to find weak steps; keep the AI instructions per output as editable, versioned settings; review ZAH feedback after each milestone |
| I7 | Company brand kit (set once, used on every PDF) and client brand (logo and products per project) | Ibrahim, 4 Nov | Planned | Brand kits are in Libraries (information-architecture.md). Workspace brand kit with the documents in M6, client assets with the brief in M2 |
| I8 | Kie.ai first, fal.ai as backup added later | Ibrahim, 4 Nov | Agreed | Kie.ai tested in M1. Add fal.ai as the automatic backup when generation is built in M5 |
| I9 | Shot options before any generation: aspect ratio, camera lens, camera movement, shot size, duration, chosen first so no credits are spent on guesses | Ibrahim, 4 Nov | Planned for M4 and M5 | The brain proposes them from the brief and storyboard; the person can change them on each shot before generating. Cost shown with them |
| I10 | One brain that decides everything from the brief (script, treatment, image and camera choices) so the person rarely regenerates | Ibrahim, 4 Nov | In progress | Started in M2 (`src/lib/ai/brain.ts`). Each stage passes its approved outputs to the next. "Training" means better instructions and examples from approved ZAH work plus the edit and regenerate counts (I6), not training a model |
| I11 | Test one video per model in sequence (Kling 0 to 5 sec, Seedance 6 to 10, Veo 11 to 15) | Ibrahim, 4 Nov | Later | Testing paused to save money (decisions-build.md B5) |
| I12 | Voice brief model | Ibrahim, 4 Nov | Built (M2) | Gemini 3.8 Flash through Kie.ai turns the voice note into text, Claude reads it |
