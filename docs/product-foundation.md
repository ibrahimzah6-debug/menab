# Menab: Product Foundation

Phase 01 · Draft v0.3 · Nov 2, 2026 · @IBRAHIM

Menab is a production operating system: it turns one client brief into delivered content through AI, traditional, or hybrid production, inside one workspace. This draft is for review; nothing here is final until it moves to the decision log.

**How to read the tags**

- **\[Confirmed\]**: stated by Ibrahim in the project brief or earlier planning.
- **\[Assumption\]**: my reading of intent; needs your yes or no.
- **\[Recommendation\]**: my proposal, with the reason.
- **\[Open\]**: a question we must answer before or during Phase 02.

## 1. Product Vision

**\[Confirmed\]** One brief. One workspace. Multiple production pathways. One integrated production experience.

**My understanding:** The product does not generate content first; it runs production. It takes a client from a rough idea to a validated brief, builds connected creative outputs (concept, script, characters, storyboard), recommends how to make it (AI, a production house, or both), then carries the project through pre-production, execution, post, approvals, delivery, and archive. AI is the assistant inside every stage, not the product itself.

**\[Recommendation\] Working positioning:** *The production operating system for brands, agencies, and production companies, from brief to delivery, through AI, traditional, or hybrid production.*

**\[Confirmed\]** Saudi Arabia first, worldwide later. The idea grew from ZAH's own production work and the earlier brief-to-production-house bidding concept.

**\[Confirmed\] Rollout:** ZAH team tests it internally first, then selected production houses, then public launch. Planning, architecture, and UI/UX happen in this chat project; the build happens in Claude Code.

**\[Confirmed\]** The product will be a separate company. Name: Menab (مِناب), domain menab.si.

## 2. Problem Statement

The core problem is not "too many tools"; it is that nothing holds the project together, so decisions, versions, and approvals get lost between stages.

**\[Confirmed\]** Production is spread across separate tools for briefing, creative, storyboards, planning, AI generation, editing, feedback, approvals, files, and delivery.

**\[Assumption\] The deeper problems underneath:**

1. **Weak briefs.** Clients rarely give duration, platforms, budget, mandatories, or deadlines up front. Every later stage pays for it.
2. **Pathway is guesswork.** Choosing AI vs. production house vs. hybrid depends on who you ask, not on the project's needs, budget, and risk.
3. **Broken creative chain.** A script change does not update the storyboard, shot list, or budget. People re-check by hand.
4. **Approvals live in WhatsApp and email.** No single record of who approved which version, and when.
5. **AI tools have no memory of the project.** Characters, brand rules, and references must be re-fed to every tool; consistency breaks.
6. **Production houses receive poor inputs.** They quote blind, so bids are hard to compare and scopes drift.

**\[Confirmed\] Problem #1:** AI video is inconsistent: characters change between shots, camera movement drifts, and elements go missing.

**\[Recommendation\]** The fix is structure: a complete brief, then character, location, and style references locked per project that every generation must follow.

## 3. Target Users

**\[Confirmed\]** Three user paths: full AI, production house (paperwork and creative support, no AI video needed), and hybrid. Anyone can start from a brief: client, production house, or ZAH team. The ZAH team is the first user.

| User | Path | Main job | Rollout stage |
| --- | --- | --- | --- |
| ZAH team (producers, coordinators) | All three | Test every flow on real jobs | Stage 1, internal |
| AI video creators and brands | Full AI | Brief → consistent AI video | Stage 1 via ZAH; Stage 3 public |
| Production houses | Production house, hybrid | Storyboard, moodboard, creative, call sheet, CPS from a brief | Stage 2, pilot |
| Clients | Any (brief owner, reviewer) | Brief, review, approve | Stage 2 to 3 |
| Directors, creatives, crew | Any | Edit treatment, view call sheets | Later |

**\[Confirmed\]** During internal testing, clients receive exports and do not log in.

## 4. Core Value Proposition

**\[Recommendation\] One line:** From brief to delivery in one connected workspace, with AI deciding nothing alone and every decision on record.

| For | Value | What they stop doing |
| --- | --- | --- |
| Production teams | Complete briefs, auto-built production docs (treatment, PPM, call sheet, CPS), one approval trail | Chasing missing info, rebuilding documents by hand |
| Clients | Clear status, one place to review and approve, visible cost and timeline trade-offs | Following up on WhatsApp, approving the wrong version |
| Agencies | Creative outputs that stay linked as ideas change | Re-checking every asset after a script edit |
| Production houses (later) | Structured scopes that make quoting fair and fast | Bidding blind |

**\[Confirmed\]** Every step is editable, including by voice, and saved as its own page you can return to.

**\[Assumption\]** The strongest single promise to test with clients: *"Know the right way to make it, and what it will cost, before you commit."*

## 5. Product Differentiation

"All-in-one" is not a differentiator on its own; every tool claims it. Our defensible edge is the pathway engine and the connected project graph, backed by real production know-how.

**\[Assumption\] Where competitors sit today** (categories, to verify in research):

| Category | Strong at | Gap we fill |
| --- | --- | --- |
| AI generation platforms | Generating images, video, voice | No brief, no approvals, no traditional production |
| Pre-production / production management tools | Scripts, shot lists, call sheets, scheduling | No AI pathway, weak client side |
| Review and approval tools | Frame-accurate feedback on edits | Starts late, after the shoot |
| Freelance / production marketplaces | Finding vendors | No structured scope, no project continuity |

**\[Recommendation\] Differentiators, ranked by how hard they are to copy:**

1. **Pathway engine**: recommends AI, traditional, or hybrid per scene, with cost, time, and risk. Switchable mid-project. *(Hard to copy; needs production data.)*
2. **Connected creative graph**: change a character or duration and the system flags every affected scene, shot, and budget line. *(Hard; core architecture.)*
3. **Production-grade outputs**: real call sheets, PPM booklets, budgets, not demo assets. *(Medium; needs operator expertise ZAH has.)*
4. **Saudi / MENA-first**: Arabic and English, RTL, local permits, crew, and locations. *(Medium; a strong beachhead.)*
5. **Provider-neutral AI orchestration**: best tool per task, swappable. *(Easy to copy alone; valuable combined.)*

**\[Open\]** Do we want to name 3 to 5 specific competitors and benchmark them? Done: see the Competitor Analysis doc.

## 6. Core Product Modules

**\[Recommendation\]** Fold the 15 preliminary areas into six modules on one shared core. Fewer, deeper modules keep the UI simple and stop features from becoming isolated tools.

&#91;embedded content: proposed architecture · 6 modules, 1 AI layer, 1 core\]

Modules are what people see; the AI layer and the core are what make them connected. A change in Creative Studio reaches Production Hub through the Project Graph, not by hand.

| Your preliminary area **\[Confirmed\]** | Proposed home |
| --- | --- |
| Client Workspace, Brief Assistant | Client and Brief |
| Creative Workspace | Creative Studio |
| Pre-Production Workspace, Production Management | Production Hub |
| AI Production Studio | AI Production Studio |
| Post-Production Workspace, Review and Approval | Post and Review |
| Asset Library, Brand Library, Project Archive | Libraries and Archive |
| Project Dashboard | Workflow Engine (the project's home view) |
| Team Workspace, Production House Workspace, Administration | Teams and Access |

**\[Open\]** Final navigation is a Phase 03 decision; this grouping is a starting point.

## 7. Business Model Possibilities

**\[Confirmed\]** At launch the platform is free. Users pay only for AI usage, at the provider's cost: if an image costs 5 cents, the user pays 5 cents. The app shows the cost before every generation.

**\[Recommendation\]** Use prepaid credits instead of charging per generation, because card fees on tiny payments cost more than the generation itself. A small margin can be added later, once the product proves its value.

**\[Confirmed\]** The landing page states the value clearly: the step-by-step method is what produces the best video. Wording to be drafted in Phase 05.

| Model | How it earns | Pros | Cons | Fit |
| --- | --- | --- | --- | --- |
| Service-led (ZAH executes on the platform) | Production fees per project | Revenue from day one; real usage data | Grows with headcount, not software | Phase 1 |
| AI usage credits | Pass-through AI cost + margin | Scales with output; fair for clients | Provider price swings hit margin | Phase 1 (metered from start) |
| SaaS subscription for production companies / agencies | Monthly per workspace or seat | Recurring, scalable | Needs polished self-serve product | Phase 2 |
| Marketplace commission | % of awarded production-house bids | Network effects | Needs supply and demand at once; trust issues | Phase 3 |
| Enterprise license | Annual contract (e.g., large brands, government) | Large deals | Long sales cycles; custom demands | Opportunistic |

**\[Confirmed\]** AI models are reached through one aggregator that offers many models, so users get both low-cost and top-quality options. Kie.ai is the first choice: one key and one balance for Nano Banana, Veo, Kling, Seedance, Suno, voice, and chat models, at lower prices than Krea or the official APIs. It is a reseller with mixed reliability reviews, so every call has an automatic fallback (Krea or fal.ai), outputs are saved to our own storage at once, and commercial-use terms are checked before public launch.

## 8. Product Principles

**\[Confirmed\]** Your 14 principles, grouped into six so they are easier to apply in design reviews:

1. **Workflow first, technology second**: design for real production operations, not demos; never build a feature just because it is possible. *(1, 14)*
2. **Simple on top, professional underneath**: client-friendly UI; full production depth for the team. *(2, 9)*
3. **AI-assisted, human-controlled**: AI proposes, people approve; AI is not assumed best for every task. *(3, 10)*
4. **Approval-driven and traceable**: every stage has inputs, outputs, dependencies, and a sign-off; history, versions, and decisions are kept. *(5, 6, 8)*
5. **Everything editable and connected**: creative outputs can be edited and regenerated; AI, traditional, and hybrid stay in one flow. *(7, 11)*
6. **Modular and reusable**: shared systems over isolated features; MVP kept separate from future scope. *(4, 12, 13)*

**\[Recommendation\] Three to add:**

- **Cost before generation**: show the cost and time of an AI or production action before running it.
- **Provenance and rights by default**: every asset records its source, tool, prompt, licence, and approver.
- **Bilingual from day one**: Arabic and English, RTL-ready, not translated later.

## 9. MVP Direction

**\[Confirmed\]** v1 includes both paths. The brief decides what the user gets: AI generation, production-house tools (paperwork, creative, storyboards), or a mix.

**\[Confirmed\] How a project runs:**

1. **Brief**: chat box or voice message. The user sets format and aspect ratio, length, what the video is about, and where it will be used.
2. **AI analysis**: detects missing information, asks follow-ups, suggests the pathway.
3. **Guided pages**: each step unlocks after the previous one: concept → script → characters → locations → moodboard → storyboard → shot list. Each page shows what the AI generated and stays editable.
4. **Pathway output:**
   - Full AI: images (e.g., Nano Banana), then video shots per scene, using the locked character and location references.
   - Production house: call sheet, CPS (production calendar), and other paperwork built from the same pages.
5. **Delivery**: v1 exports approved shots and assets; in-platform assembly into a finished video comes later.

**\[Confirmed\]** Arabic and English from v1, interface and voiceover.

**\[Confirmed\] Length:** v1 tests 30-second videos. Long-form, up to full films, comes later and is built from scenes of 30 seconds or more.

**\[Recommendation\]** Make the scene the core unit: a project holds sequences, sequences hold scenes, scenes hold shots. Short and long videos then work the same way. Test v1 on short pieces first; long-form multiplies AI cost and consistency risk.

**\[Confirmed\]** Several AI models, each assigned to what it does best (script, storytelling, images, video), through one orchestration layer. Exact providers and their APIs are verified in Phase 04.

**\[Confirmed\]** Each generation page has a default model (Nano Banana for images). The user can switch models, edit the prompt the AI wrote from the brief, and regenerate.

**\[Confirmed\] Internal test order:** internal projects first, then commercials, then social content and other types.

**\[Recommendation\] Built-in editor, in three steps:**

1. v1: export approved shots and assets.
2. v2: a simple timeline editor in the browser. Order and trim shots, add transitions, text and Arabic subtitles, music and voiceover, color presets, then export. This is a well-known, buildable feature.
3. v3: AI effects such as background swaps, object removal, style changes, and upscaling, run through the same orchestration layer.

Full compositing and frame-by-frame VFX, the work done in tools like After Effects or Nuke, stays outside the app. Building that is a product of its own.

| In v1 | Later |
| --- | --- |
| Chat + voice brief with format, length, purpose | Production-house bidding and marketplace |
| Guided, editable pages from concept to shot list | In-platform editing and final video assembly |
| Character, location, and style references locked per project | Music, SFX, and advanced VFX generation |
| AI images and per-scene video shots | Templates for podcasts, documentaries, photography |
| Call sheet, CPS, moodboard for production houses | Crew, casting, and location databases |
| Shot and asset export | Public self-serve sign-up and billing |
| Arabic + English | Additional languages |

## 10. Risks and Open Questions

The biggest risk is scope: the vision covers five product categories at once. The MVP must stay narrow enough to ship and use on real projects.

**\[Assumption\] Key risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scope: AI path and production-house path both in v1 | High | Build the shared foundation once; test on one project type internally |
| Long-form consistency and AI cost (up to 2 hours) | High | Scene-based structure, locked references, cost shown before generating, start short |
| AI quality not production-grade (consistency, Arabic text, faces) | High | Human approval on every page; previz before finals |
| AI provider changes: price, API access, shutdown | High | Orchestration layer; verify every provider's API before committing |
| Rights and licensing of AI assets | High | Provenance log; check each provider's commercial terms |
| Build capacity: who builds, with what budget | High | Claude Code build; scope milestones in Phase 06 |
| Clients will not adopt another tool | Medium | Producers drive; clients only review via link |
| Data residency and privacy (Saudi PDPL, government clients) | Medium | Decide hosting region in Phase 04 |
| Pathway engine needs data we do not have yet | Medium | Start rule-based from ZAH experience; learn from projects |

**Open questions for you**

- [x] Reference files from Ibrahim: treatment, CPS, call sheets, PPM booklets, permit
- [x] Aggregator: Kie.ai first, Krea or fal.ai as fallback
- [ ] Top-up by card, Apple Pay, and mada, added once the payment gateway and Kie.ai are integrated
- [ ] Landing page wording (Phase 05)
- [ ] Data and hosting rules: later, when enterprise or government clients arrive

## Decision Log and Next Steps

| # | Decision | Status |
| --- | --- | --- |
| D1 | Product is a full production OS with AI generation built in, not only an AI video generator | Confirmed |
| D2 | Three pathways: AI, traditional, hybrid; switchable mid-project | Confirmed |
| D3 | Saudi Arabia first, worldwide later | Confirmed |
| D4 | No coding before architecture and scope are agreed | Confirmed |
| D5 | Rollout: ZAH internal, then production-house pilot, then public | Confirmed |
| D6 | v1 has both paths; the brief decides which applies | Confirmed |
| D7 | v1 exports shots; editor comes in v2 (timeline) and v3 (AI effects) | Proposed |
| D8 | Arabic and English from v1 | Confirmed |
| D9 | v1 tests 30-second videos; long-form later | Confirmed |
| D10 | Scene is the core unit: project, sequence, scene, shot | Proposed |
| D11 | Planning and design here; build in Claude Code | Confirmed |
| D12 | Six modules on one shared core | Proposed |
| D13 | Separate company | Confirmed |
| D14 | Free platform; users pay AI usage at cost | Confirmed |
| D15 | Default model per step, switchable, with editable prompts | Confirmed |
| D16 | Kie.ai as the first aggregator, with automatic fallback to Krea or fal.ai | Confirmed |
| D17 | Existing ZAH tools stay separate | Confirmed |
| D18 | GAMR content approval optional; the user chooses (commercial use in Saudi) | Confirmed |
| D19 | Workflow Map v0.3: users move through 6 to 7 stages; the 55 outputs live inside them | Confirmed |
| D20 | Product name Menab (مِناب), domain menab.si; one workspace per company; Coordinators can approve stages | Confirmed |

**Next steps**

1. Review the Workflow Map (Phase 02 draft) and mark what to cut or add.
2. Share reference files (treatment, storyboard, CPS) so outputs match real formats.
