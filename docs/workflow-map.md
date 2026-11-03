# Menab: Workflow Map

Phase 02 · Draft v0.3 · Nov 3, 2026 · @IBRAHIM

Users move through 6 stages on the AI path and 7 on the production path. The AI fills a whole stage at once, the user reviews it on one screen, and approves once. The 55 outputs in the full list below live inside those stages; the user never clicks through them one by one. The list is checked against ZAH's real files: 3 CPS, 5 call sheets, 2 PPM booklets, 1 director's treatment, and 1 GAMR filming permit.

## What the user sees: stages, not pages

**\[Recommendation\]** Shown as "Stage 2 of 6: Creative". Each stage is one screen with tabs for its outputs.

| Stage | AI path | Production path | Outputs inside | User approves |
| --- | --- | --- | --- | --- |
| 1. Brief | Yes | Yes | 1 to 6 | The brief, pathway, and CPS |
| 2. Creative | Yes | Yes | 7 to 12 | One creative direction, script, treatment |
| 3. Look and characters | Yes | Yes (called Development) | 13 to 19 | Characters, wardrobe, locations, storyboard |
| 4. Pre-production | No | Yes | 20 to 33 | Budget, permits, PPM, call sheets |
| 5. Generate or Shoot | Generate | Shoot | 34 to 38 | Final shots |
| 6. Edit | Yes (v2) | Yes (v2) | 39 to 49 | Final master |
| 7. Deliver | Yes | Yes | 50 to 55 | Delivery |

**How it stays short and clear:**

- **One approval per stage.** The AI path in v1 has 5 approvals, not 25.
- **The AI runs ahead.** While the user reads the script, the treatment and visual mood are already being written.
- **Open only what matters.** Each tab shows a short summary; the user expands a tab only to edit or regenerate it.
- **Hidden when not needed.** Outputs that do not apply never appear: no permits for a studio-only shoot, no drone permit without a drone, no GAMR step unless the user chooses it.
- **Clear progress.** A stage bar at the top, with a time and cost estimate for the stage before it starts.

## At a glance

&#91;embedded content: project flow · 8 phases, 2 paths\]

The AI path goes from Development straight to AI Generation. The production path adds pre-production and a shoot. Hybrid projects use both, scene by scene.

## Full output list

This is the build list for Claude Code: every output the app produces, in order. Users see these as tabs inside a stage. Outputs 34 to 38 differ by path. **New in v0.2** marks outputs added after the check against ZAH's files.

| # | Phase | Output | What the AI does | Path | In v1 |
| --- | --- | --- | --- | --- | --- |
| 1 | Brief and strategy | Brief intake | Turns chat or voice into a structured brief; user uploads products, logos, references | Both | Yes |
| 2 | Brief and strategy | Brief questions | Asks only for what is missing | Both | Yes |
| 3 | Brief and strategy | Brief summary | Writes the brief for sign-off | Both | Yes |
| 4 | Brief and strategy | Strategy and deliverables | Insight, key message, tone, platforms, and the full deliverables list (durations, ratios, cutdowns) | Both | Yes |
| 5 | Brief and strategy | Pathway and estimate | Recommends AI, production, or hybrid, with a cost and time range | Both | Yes |
| 6 | Brief and strategy | Kickoff and CPS | First CPS draft from brief to delivery; kickoff notes. **New in v0.2** | Both | Yes |
| 7 | Creative | Creative directions | Two or three directions, each with its idea and references | Both | Yes |
| 8 | Creative | Creative meeting | Compares directions; client picks one, notes recorded | Both | Yes |
| 9 | Creative | Script | AV script: picture and sound side by side, voiceover, Arabic and English | Both | Yes |
| 10 | Creative | Director's treatment | Idea, tone, shot-by-shot frames with shot size and VO, cast, wardrobe, locations, art | Both | Yes |
| 11 | Creative | Visual mood | Look, color, light, camera language | Both | Yes |
| 12 | Creative | Creative approval | Packages pages 7 to 11 for client sign-off | Both | Yes |
| 13 | Development | Characters | Character sheets for AI, or a casting brief with Plan A and Plan B options | Both | Yes |
| 14 | Development | Wardrobe | Outfit per character per scene, with continuity notes. **New in v0.2** | Both | Yes |
| 15 | Development | Locations | AI location references, or location options with photos | Both | Yes |
| 16 | Development | Art direction | Set dressing and props per set | Both | Yes |
| 17 | Development | Storyboard | Numbered frames: image, shot size, angle, movement, action, dialogue or VO, duration | Both | Yes |
| 18 | Development | Shot list | Per shot: scene, INT or EXT, day or night, frame, cast, props, set | Both | Yes |
| 19 | Development | Animatic | Storyboard timed to VO and music | Both | Later |
| 20 | Pre-production | Budget and quote | Line-item budget and quote against the deliverables | Production | Yes |
| 21 | Pre-production | Award and contract | Client approves quote; job awarded. **New in v0.2** | Production | Later |
| 22 | Pre-production | Crew list | Crew by department; checks each person's GAMR media professional registration. **New in v0.2** | Production | Yes |
| 23 | Pre-production | Casting | Casting session and final selection, main cast and extras | Production | Later |
| 24 | Pre-production | Location scout | Scout photos and notes per location | Production | Later |
| 25 | Pre-production | Permits | GAMR filming certificate data, venue written approvals, GACA drone permit if needed | Production | Yes |
| 26 | Pre-production | Equipment list | Camera, lighting, grip, and sound from the shot list | Production | Yes |
| 27 | Pre-production | PPM booklet | Assembles the booklet from pages 4 to 26 | Production | Yes |
| 28 | Pre-production | PPM meeting | Client sign-off and change log | Production | Yes |
| 29 | Pre-production | Tech recce | Final location walk with heads of department. **New in v0.2** | Production | Later |
| 30 | Pre-production | Fittings and tests | Wardrobe fitting, makeup and camera tests. **New in v0.2** | Production | Later |
| 31 | Pre-production | Shooting schedule | Shoot days, set order, shots per set, prep time per set | Production | Yes |
| 32 | Pre-production | Call sheets | One per shoot day | Production | Yes |
| 33 | Pre-production | Pre-light | Lighting setup the day before. **New in v0.2** | Production | Later |
| 34 | Production | Reference lock | Locks characters, wardrobe, locations, and style for every generation | AI | Yes |
| 35 | Production | Keyframes | One image per storyboard frame; default model Nano Banana | AI | Yes |
| 36 | Production | Video shots | One clip per shot from its keyframe and camera move | AI | Yes |
| 37 | Production | Voice | AI voiceover from the approved script | AI | Yes |
| 38 | Production | Shot review | Review, regenerate, switch model or prompt | AI | Yes |
| 34 | Production | Shoot day | Live call sheet, shots done per set | Production | Later |
| 35 | Production | Continuity | Continuity notes per take (wardrobe, props, positions) | Production | Later |
| 36 | Production | Data and rushes | DIT backup log and rushes upload | Production | Later |
| 37 | Production | Daily report | Day summary, delays, overtime | Production | Later |
| 38 | Production | Selects | Best takes marked per shot | Production | Later |
| 39 | Post-production | Offline edit | First assembly | Both | v2 |
| 40 | Post-production | Director's session | Director's cut. **New in v0.2** | Both | v2 |
| 41 | Post-production | Client feedback | Comment rounds on timecode | Both | v2 |
| 42 | Post-production | Offline lock | Locked edit | Both | v2 |
| 43 | Post-production | VFX and graphics | Effects, motion graphics, AI fixes | Both | v3 |
| 44 | Post-production | Color grade | Final look | Both | v2 |
| 45 | Post-production | Music and licensing | Music choice and license record. **New in v0.2** | Both | v2 |
| 46 | Post-production | Sound design and mix | Final audio | Both | v2 |
| 47 | Post-production | Subtitles and supers | Arabic and English text on screen | Both | v2 |
| 48 | Post-production | Online and master | Conform and final master | Both | v2 |
| 49 | Post-production | Final approval | Client sign-off on master | Both | v2 |
| 50 | Delivery | Cutdowns and adaptations | 30, 15, and 6 second cuts; 16:9, 9:16, 1:1 | Both | v2 |
| 51 | Delivery | QC | Duration, format, and spelling check | Both | v2 |
| 52 | Delivery | GAMR content approval | Asks if the video will be published commercially in Saudi. If yes, a copy goes to GAMR and nothing is published before approval (permit condition 5). New in v0.2 | Both, user chooses | Yes |
| 53 | Delivery | Export | v1 exports approved shots and assets | Both | Yes |
| 54 | Delivery | Rights record | Cast releases, music licenses, AI models used | Both | Yes |
| 55 | Wrap | Archive | Wrap report and project archive | Both | Yes |

## How the brief decides the path

At output 5 the AI reads the brief and proposes a path; the user can always override it. In hybrid, the choice is made scene by scene.

| Signal in the brief | Suggested path |
| --- | --- |
| Real product, real talent, or a real location must appear on camera | Production |
| Stylized, fantasy, or hard-to-film scenes | AI |
| Tight budget or very short deadline | AI |
| Real product or person, with impossible or costly environments | Hybrid |
| User already has a crew and needs only paperwork and creative | Production tools only |

**What each path sees:**

- **AI:** stages 1, 2, 3, Generate, Edit, Deliver. In v1: 5 stages, 5 approvals.
- **Production:** all 7 stages, with Shoot in stage 5.
- **Hybrid:** all 7 stages; each scene in the shot list is tagged AI or shoot, and stage 5 shows both.

## Open points for Ibrahim

**\[Confirmed\]** Decisions from Ibrahim, 3 Nov:

- GAMR content approval is optional on both paths. The user decides; it applies when the video is commercial and published in Saudi.
- Storyboard: the user picks sketch or photo-real frames.
- Budget: built later from a strong public reference, in ZAH's design, unless Ibrahim shares ZAH's own template first.
- The v1 column is confirmed.
- Users see 6 to 7 stages, not 55 pages; one approval per stage (v0.3). Next: Phase 03, Information Architecture.

## What each document must contain

These are the fields the app must fill so its output matches what ZAH and its partners already use. They come from ZAH's files; the storyboard row comes from industry practice and the Bogshah PPM.

| Document | Must contain | Built from |
| --- | --- | --- |
| CPS | Weekly calendar (Sunday to Saturday, Arabic and English); milestones: brief and products received, kickoff, creative, creative meeting, approval, prep, scout, PPM, recce, pre-light, shoot days, editing, director's session, offline delivery, client feedback, offline lock, VFX, grade, final delivery, cutdowns; color bands for pre-production, production, post; note that final delivery depends on revisions | CPS Almatar, Sharbatli, Maestro |
| Director's treatment | Creative directions; per video: idea, reference, shot-by-shot frames (shot size, description, VO), cast with Plan A and Plan B, wardrobe, location options, art per room | Ninja treatment (RGB) |
| Storyboard | Numbered frames; per frame: image, shot size, angle, camera move, action, dialogue or VO, duration, sound notes | Bogshah PPM, industry practice |
| PPM booklet | Cover; brief; crew list; storyline per scene; storyboard; visual mood; cinematography; production design; editing and sound; locations with photos; main and secondary cast with options; extras; art per scene; wardrobe and shoes per character per scene, with continuity | Bogshah (Domino's), NOVA |
| Call sheet | Project and day (e.g. Day 3 of 3); date; key people; crew call, client call, roll, meals, wrap; weather, sunrise, sunset; crew by department with call and pickup times; locations with map links, parking, contact; nearest hospital, emergency numbers; per set: time, scene, INT or EXT, day or night, shot numbers, cast, props, prep time; safety notes | Ninja, Nafitha, RADO, SPL, Manjm |
| GAMR filming permit | Company name and license number; issue and expiry; responsible person; type (video, photo); purpose; crew with national ID or iqama and role; locations by region, city, place; 11 conditions | ZAH permit L-PP-2026-000300 |

**Saudi rules the app must enforce** (from the permit and GAMR):

- Every crew member must be professionally registered with GAMR. The crew list page checks this.
- Written approval from each venue filmed inside; drones need a GACA permit and a registered drone.
- No filming or publishing people without consent; cast releases go in the rights record.
- First aid on outdoor sets, site clean-up, and labor-hour rules: added to the call sheet as checklist items.
- A copy of the final content goes to GAMR; nothing is published before approval.

## Sources

- [GAMR: Filming permit certificate](https://gamr.gov.sa/en/services/no-objection-certificate-for-filming-permit) (500 SAR, 1 day, online, team details required)
- [Saudi Film Commission FAQ](https://film.sa/faq) (GAMR permit for public locations, venue clearance, GACA drone permit)
- [Yamdu: Pre-production meeting](https://yamdu.com/en/learn/preproduction/preproduction-meeting-ppm/)
- [Studio Liddell: TV commercial production guide](https://studioliddell.com/news/tv-commercial-production-the-guide)
- ZAH files: 3 CPS, 5 call sheets, 2 PPM booklets, 1 treatment, 1 filming permit
