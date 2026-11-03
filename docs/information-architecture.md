# Menab: Information Architecture

Phase 03 · v1.0, approved · Nov 3, 2026 · @IBRAHIM

The app has one main action, starting a project from a brief, and one main screen, the stage screen inside a project. Everything else supports those two.

## App map

&#91;embedded content: app map · side menu and a project\]

A project is where the work happens. Libraries hold what a company reuses, such as its brand kit and recurring characters; a project locks a copy so later library edits do not change approved work.

## Main navigation

**\[Recommendation\]** Seven areas in a side menu. A large "New project" button sits above them, because starting a brief is the main action in the app.

| Area | What it holds | In v1 |
| --- | --- | --- |
| Home | Projects in progress, what waits for my approval, recent activity, credit balance | Yes |
| Projects | All projects; filter by stage, path (AI, production, hybrid), client, status | Yes |
| Libraries | Reusable items across projects: brand kits, characters, locations, assets | Yes |
| Templates | Project types (Commercial first) and document templates (CPS, call sheet, PPM, treatment, budget) | Yes, Commercial only |
| Team | Members and roles; later, crew directory with GAMR registration status | Members only |
| Credits | Balance, cost per project and per model, top-up | Balance and usage; top-up later |
| Settings | Language, account, default AI model per task, notifications | Yes |

**\[Confirmed\]** Clients do not log in during internal testing; they receive exports. Client and production-house portals come in Stage 2.

## Inside a project: the stage screen

**\[Recommendation\]** One layout for every stage, so users learn it once.

&#91;embedded content: stage screen wireframe · example: stage 2\]

- **Header:** project name, path, cost so far, balance, and the AR / EN switch.
- **Stage bar:** the current stage stands out; past stages open in read mode; future stages are locked. Stages that do not apply to the path are hidden, so the AI path shows 6.
- **Outputs panel:** the tabs of this stage with their status. The AI fills them in order while the user reads.
- **Open output:** the work itself, with Edit, Regenerate, and Versions.
- **Assistant:** chat or voice that knows the open output; model picker and editable prompt; cost shown before any generation; comments.
- **Footer:** stage cost and time, and one Approve button that unlocks the next stage.
- **On a phone:** the three panels stack, and the assistant opens as a sheet from the bottom.

**\[Confirmed\] Board view, the live canvas.** Each stage can switch between Page view (the layout above) and Board view. Board view shows the stage's outputs as cards on a canvas. While the AI works, the user watches a labelled AI cursor create each card and fill it live: treatment, visual ideas, keyframes, look and feel, music, equipment, boards. The user can drag cards, zoom, and click any card to edit or regenerate it. Both views show the same outputs and versions, so nothing in the approval chain changes. Inspired by Storyflow's AI-controlled canvas.

## How a project is organised

&#91;embedded content: project structure · approval chain and content chain\]

The approval chain is what users click through: stages, their outputs, and versions. The content chain is what the outputs describe: sequences, scenes, and shots. The shot is the meeting point; each shot carries its storyboard frame, keyframe, clip, and whether it is made with AI or shot for real. This is what lets a change to a character flag every shot it appears in, and what makes short ads and long films work the same way.

## Roles

**\[Recommendation\]** Four roles inside a workspace in v1. Outside roles join in Stage 2 with limited views.

| Role | Can do | When |
| --- | --- | --- |
| Admin | Everything; manages team, credits, and settings | v1 |
| Producer | Creates projects, generates, edits, approves stages | v1 |
| Coordinator | Generates, edits, and approves stages; builds crew lists and paperwork; spends up to a limit the Admin sets | v1 |
| Viewer | Reads projects and comments | v1 |
| Client reviewer | Opens a review link, comments, approves what is sent to them | Stage 2 |
| Production house | Sees only the projects shared with them; edits pre-production and shoot outputs | Stage 2 |
| Crew member | Sees their call sheet and schedule only | Later |

## Global rules

- **Language:** Arabic and English, switchable at any time. Arabic is right to left across the whole interface. Each output can be generated in Arabic, English, or both.
- **Assistant everywhere:** the chat and voice panel is available on every screen, and knows which project and output is open.
- **Cost before action:** every generate button shows its cost and the remaining balance before it runs.
- **Nothing is lost:** every edit and regeneration creates a version; any version can be restored.
- **Exports:** treatment, storyboard, PPM booklet, call sheets, and CPS as PDF; budget and shot list as Excel; media as a zip. PDFs follow the workspace brand kit, so each company's documents carry its own logo and colors.
- **Statuses:** every output shows one of five: Waiting, Generating, Ready, Edited, Approved.
- **Search:** one search across projects, outputs, characters, and locations.

## Decisions

**\[Confirmed\]** Decisions from Ibrahim, 3 Nov:

- One workspace per company. ZAH has its own; each production house gets its own later.
- Coordinators can approve stages.
- Working product name: **Menab (مِناب)**.
- Main navigation approved as drafted.
