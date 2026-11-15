import "server-only";
import { z } from "zod";
import { MENAB, lessons, remembered } from "./brain";
import { structured, type Step } from "./brain-core";

// Stage 3, Look and characters (workflow-map.md, outputs 13 to 18): characters, wardrobe,
// locations, art direction, the shot list and the storyboard. Three calls: characters with
// wardrobe and locations with art direction run side by side; then the shots, which need both.
// Characters and locations saved in the workspace's Libraries are offered to reuse; a reused
// one keeps its library id, and its photos guide the storyboard frames.

export const Cast = z.object({
  characters: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().describe("Their part in the story, e.g. 'The father, lead'"),
        age: z.string(),
        look: z.string().describe("Face, hair, build, expression: precise enough to draw the same person in every frame"),
        personality: z.string(),
        made_with: z.enum(["ai", "cast"]).describe("ai: an AI character sheet; cast: a real actor to cast"),
        plan_a: z.string().describe("For cast: the ideal actor type; for AI: the reference look"),
        plan_b: z.string().describe("A second option"),
        library_id: z.string().nullable().describe("The id of a library character this reuses, else null"),
      }),
    )
    .describe("Everyone who appears on screen, leads first"),
  wardrobe: z
    .array(
      z.object({
        character: z.string(),
        scene: z.string().describe("Scene number or name from the script"),
        outfit: z.string(),
        continuity: z.string().describe("What must stay the same between shots, or empty"),
      }),
    )
    .describe("Outfit per character per scene"),
});
export type Cast = z.infer<typeof Cast>;

export const Places = z.object({
  locations: z.array(
    z.object({
      name: z.string(),
      int_ext: z.enum(["INT", "EXT"]),
      description: z.string().describe("What it looks like, light at that time of day, size"),
      made_with: z.enum(["ai", "real"]).describe("ai: generated; real: a real place to scout"),
      options: z.array(z.string()).describe("2 or 3 options: real places in Saudi to scout, or AI looks"),
      library_id: z.string().nullable().describe("The id of a library location this reuses, else null"),
    }),
  ),
  art: z.array(
    z.object({
      set: z.string().describe("Location or set name"),
      dressing: z.string().describe("How the set is dressed"),
      props: z.array(z.string()),
    }),
  ),
});
export type Places = z.infer<typeof Places>;

export const Shots = z.object({
  shots: z
    .array(
      z.object({
        n: z.number().describe("Shot number, 1, 2, 3 in order"),
        scene: z.string(),
        int_ext: z.enum(["INT", "EXT"]),
        day_night: z.enum(["DAY", "NIGHT", "DUSK", "DAWN"]),
        size: z.string().describe("Wide, Medium, Close-up, Extreme close-up, Insert, Over the shoulder"),
        angle: z.string().describe("Eye level, Low angle, High angle, Top down, Dutch"),
        movement: z.string().describe("Static, Push in, Pull out, Pan, Tilt, Handheld, Dolly, Crane, Tracking"),
        lens: z.string().describe("e.g. 24mm, 35mm, 50mm, 85mm"),
        action: z.string().describe("What happens in this shot"),
        dialogue: z.string().describe("VO or dialogue in this shot, or empty"),
        seconds: z.number(),
        cast: z.array(z.string()).describe("Character names in the shot"),
        props: z.array(z.string()),
        set: z.string().describe("Location name"),
        image_prompt: z
          .string()
          .describe(
            "An English prompt to draw this frame: the shot size, angle and lens; who is in it by their look (not just their name); what they do; the place, light and time of day; the mood and colour from the visual mood. One paragraph. No text, logos or subtitles in the image unless the shot is the end card.",
          ),
      }),
    )
    .describe("Every shot of the main film in order, following the script and the treatment. Their seconds add up to the film length."),
});
export type Shots = z.infer<typeof Shots>;

type Ctx = {
  brief: unknown;
  creative: unknown;
  path: string | null;
  language: string;
  modelId: string;
  library: { characters: unknown[]; locations: unknown[] };
  memory?: string[];
  rules?: string[];
  onStep?: (s: Step) => void;
  signal?: AbortSignal;
};

const system = (c: Ctx) => `${MENAB}\n${remembered(c.memory)}${lessons(c.rules)}`;
const base = (c: Ctx) =>
  `Brief: ${JSON.stringify(c.brief)}\nPath: ${c.path ?? "not chosen"} (production: cast real actors and scout real places; ai: AI characters and places; hybrid: decide per item)\nApproved creative (direction, meeting notes, script, treatment, visual mood): ${JSON.stringify(c.creative)}\nWrite in: ${c.language}. Keep names consistent with the script.`;

export function writeCast(c: Ctx, instruction?: string, current?: unknown) {
  const ask = instruction
    ? `Revise the characters and wardrobe with this change from the producer: "${instruction}". Keep the rest.\nCurrent: ${JSON.stringify(current)}`
    : `Write the characters and the wardrobe. Characters from the company's library you may reuse (set library_id when you do): ${JSON.stringify(c.library.characters)}. Never include national ID or iqama numbers.`;
  return structured(c.modelId, system(c), [{ role: "user", content: `${ask}\n\n${base(c)}` }], Cast, { effort: "low", maxTokens: 5000, onStep: c.onStep, signal: c.signal, timeoutMs: 120_000 });
}

export function writePlaces(c: Ctx, instruction?: string, current?: unknown) {
  const ask = instruction
    ? `Revise the locations and art direction with this change from the producer: "${instruction}". Keep the rest.\nCurrent: ${JSON.stringify(current)}`
    : `Write the locations and the art direction. Locations from the company's library you may reuse (set library_id when you do): ${JSON.stringify(c.library.locations)}.`;
  return structured(c.modelId, system(c), [{ role: "user", content: `${ask}\n\n${base(c)}` }], Places, { effort: "low", maxTokens: 5000, onStep: c.onStep, signal: c.signal, timeoutMs: 120_000 });
}

export function writeShots(c: Ctx & { cast: unknown; places: unknown; seconds: number }, instruction?: string, current?: unknown) {
  const ask = instruction
    ? `Revise the shot list and storyboard prompts with this change from the producer: "${instruction}". Keep the rest and keep the total at ${c.seconds} seconds.\nCurrent: ${JSON.stringify(current)}`
    : `Write the shot list for the ${c.seconds} second main film, one shot per storyboard frame, with an image prompt for each frame. Describe what is in the frame; the drawing style (sketch or photo-real) is added when the frame is drawn.`;
  return structured(
    c.modelId,
    system(c),
    [{ role: "user", content: `${ask}\n\nCharacters and wardrobe: ${JSON.stringify(c.cast)}\nLocations and art: ${JSON.stringify(c.places)}\n\n${base(c)}` }],
    Shots,
    { effort: "low", maxTokens: 8000, onStep: c.onStep, signal: c.signal, timeoutMs: 150_000 },
  );
}

// The shots add up to the film length, within 2 seconds; otherwise they are scaled to fit.
export function fitShots(s: Shots, seconds: number): Shots {
  const total = s.shots.reduce((n, x) => n + (Number(x.seconds) || 0), 0);
  if (!s.shots.length || total <= 0 || Math.abs(total - seconds) <= 2) return s;
  const k = seconds / total;
  const shots = s.shots.map((x, i) => ({ ...x, n: i + 1, seconds: Math.max(1, Math.round((Number(x.seconds) || 0) * k * 2) / 2) }));
  const diff = seconds - shots.reduce((n, x) => n + x.seconds, 0);
  shots[shots.length - 1].seconds = Math.max(1, shots[shots.length - 1].seconds + diff);
  return { shots };
}
