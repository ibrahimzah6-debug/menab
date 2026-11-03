Menab takes a video from a brief to delivery, made with AI, shot by a production house, or both. The design has two faces: a dark, cinematic website that shows what Menab can do, and a light, calm app where the work happens one stage at a time.

## Principles

- **Step by step.** One stage on screen, one approval per stage. Never show a user more than they need right now.
- **Watch it happen.** The AI's work is visible: cards appear on the board and fill as it writes.
- **Cost before action.** Every generate button shows its price first.
- **Arabic and English as equals.** Every screen works right to left. Neither language is a translation afterthought.
- **Control when you want it.** Simple by default; shot controls, model choice and prompts sit one click away.

## Content and voice

Write like a producer talking to a colleague: plain, warm and direct.

- Short sentences, active voice, verbs first on buttons: "Approve stage 2", "Generate keyframes", "اعتماد المرحلة".
- Sentence case everywhere. No exclamation marks in system text.
- Never use em dashes. Use a comma, a colon, or a new sentence.
- No filler words such as "seamless", "unlock", "leverage", "simply". Say what happens.
- Talk to the user as "you". The AI is "Menab AI" on the board, never "I" in system text.
- Errors say what went wrong and what to do: "That generation failed, so you weren't charged. Try again or switch model."
- Use the industry's own words: CPS, PPM, call sheet, treatment, shot list. Explain them once in a tip, then use them.
- Arabic copy is written, not translated. Prefer Saudi everyday phrasing in the app; formal Arabic only in documents.

## Color

Menab is black, white and gray, taken from Storyflow's palette. Color is almost never used.

- The app uses the **Light** theme: `ground` (off-white #FAF9F6) behind everything, `surface` (white) for cards and panels, `ground-deep` for the board canvas and the outputs list.
- The website and dark mode use the **Dark** theme: Storyflow's charcoal (`ground` #1F1F1F, `ground-deep` #1A1A1A, `surface` #212121) with white text.
- Grays come from transparency, as on Storyflow: `tint-1`, `tint-2`, `tint-3` for washes, `line` and `line-strong` for borders, `ink-muted` and `ink-faint` for softer text.
- Body text is `ink`; supporting text `ink-muted`; captions and placeholders `ink-faint`.
- The main action of a view is a `primary` pill: charcoal in light, off-white in dark.
- `accent` (Storyflow's orange #FF5925) is rare: the single most important call to action on a screen, such as Start your project on the website, and the small New dot. Most app screens use no accent at all. Text on it is always `on-accent`.
- Status is never shown by color. Approved is a filled `primary` chip with a check; generating is an outline with a spinner; failed is a dashed outline with an alert icon and the words "Failed, no charge".
- Focus rings are 2px `focus`, offset 2px.

## Type

- All text, Arabic and English, is set in **Rubik**, so both languages match. Labels and data use **JetBrains Mono**. Both load from Google Fonts.
- Use the styles by name: `display` on the website hero only, `h1` for project names, `h2` for stage titles, `h3` for card titles, `body` for running text, `small` for meta lines, `button` for controls.
- Arabic running text uses `body-ar`: one size up with more leading.
- `label` is uppercase mono with letter spacing, for card labels like "03 CALL SHEET · 9 CREW" and counters like "01 / 07". Latin only.

## Shape and space

- Buttons and stage segments are pills (`radius-pill`). Cards use `radius-md`, large panels `radius-lg`, chips and inputs `radius-sm`.
- Space comes from the scale: `space-4` inside cards, `space-6` between cards, `space-12` between sections, `space-16` between website sections. Leave generous room; crowding is the most common mistake.
- Page cards use a `line` border, not a shadow, like Storyflow. Only board cards and floating menus get `shadow-card` or `shadow-float`.

## Layout

- **Stage screen, Page view:** header, stage bar, outputs list on the start side, the open output in the middle, the assistant on the end side, the approve bar at the bottom. On a phone the panels stack and the assistant opens from the bottom.
- **Board view:** the same outputs as cards on the dotted canvas, with the Menab AI cursor writing live.
- In Arabic the whole layout mirrors: start and end sides swap, and so do arrows and the stage bar's direction.

## Motion, 3D and teaching

- In the app, motion explains what the AI is doing: cards appear, text types in, the cursor moves. Nothing moves for decoration. Respect reduced motion: show the result without animation.
- The website teaches the way expo.dev does. One large isometric line drawing, built from the folded Menab "M" as a 3D box in `line-strong` hairlines with dashed hidden edges and one filled face, sits beside a numbered list of the stages ("01 Brief", "02 Creative" and so on).
- Each step in the list has a play button and a two-line explanation. Clicking a step, or scrolling to it, rebuilds the drawing for that stage and plays a short clip of the real screen.
- The drawings are SVG line art that assembles as the visitor scrolls, in white and gray only. One part of a drawing may be filled to show what that stage produces.
- 3D stays on the website. The app itself is flat.

## Iconography

- Use one outline icon set with a 1.5px stroke, sized 16 or 20px, colored by the text token next to it. Tabler Icons (outline) is the working choice; no brand icon set exists yet.
- No emoji in the interface.

## Logo

- See the Logos group. Use the ink logo on light grounds and the light logo on dark grounds. The orange mark is for rare moments only, such as the loading screen.
