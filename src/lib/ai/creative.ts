import "server-only";
import { z } from "zod";
import { MENAB, lessons, remembered } from "./brain";
import { structured, type Step } from "./brain-core";

// Stage 2, Creative (workflow-map.md, outputs 7 to 12): directions, the creative meeting,
// the AV script, the director's treatment and the visual mood. Each is one AI call; the
// script runs first and the treatment and mood follow while the person reads it.

export const Directions = z.object({
  directions: z
    .array(
      z.object({
        title: z.string().describe("A short name for the direction, 2 to 5 words"),
        idea: z.string().describe("The idea in one or two sentences"),
        story: z.array(z.string()).describe("3 to 6 beats, in order"),
        feeling: z.string().describe("Tone, pace and music feeling"),
        why: z.string().describe("Why it works for this brief and audience"),
        references: z.array(z.string()).describe("2 or 3 described references: a film, ad or look, and what to take from it"),
        risk: z.string().describe("What is hard or risky about it, and how the chosen path handles it"),
      }),
    )
    .describe("Exactly 3 directions that are truly different from each other: for example emotional, funny, bold."),
  recommendation: z.string().describe("Which direction you would pick and why, in one or two sentences"),
});
export type Directions = z.infer<typeof Directions>;

export const Script = z.object({
  title: z.string(),
  rows: z
    .array(
      z.object({
        scene: z.string().describe("Shot or scene number, e.g. 1, 2a"),
        picture: z.string().describe("What we see"),
        sound: z.string().describe("Music, sound effects, ambience"),
        vo_ar: z.string().describe("Voiceover or dialogue in Saudi dialect Arabic, or empty"),
        vo_en: z.string().describe("The same line in English, or empty"),
        super: z.string().describe("On-screen text, or empty"),
        seconds: z.number().describe("Duration of this row in seconds"),
      }),
    )
    .describe("The AV script, picture and sound side by side. The seconds add up to the main film length."),
  notes: z.string().describe("A short note for the director or editor, or empty"),
});
export type Script = z.infer<typeof Script>;

export const Treatment = z.object({
  idea: z.string(),
  tone: z.string(),
  references: z.array(z.string()),
  frames: z
    .array(
      z.object({
        n: z.number(),
        shot_size: z.string().describe("e.g. Wide, Medium, Close-up, Extreme close-up, Insert"),
        description: z.string(),
        vo: z.string().describe("The voiceover or dialogue on this frame, or empty"),
      }),
    )
    .describe("Shot by shot, following the script"),
  cast: z.array(z.object({ role: z.string(), description: z.string(), plan_a: z.string(), plan_b: z.string() })),
  wardrobe: z.array(z.object({ character: z.string(), look: z.string() })),
  locations: z.array(z.object({ name: z.string(), options: z.array(z.string()), notes: z.string() })),
  art: z.array(z.object({ space: z.string(), notes: z.string() })).describe("Art direction per room or set"),
});
export type Treatment = z.infer<typeof Treatment>;

export const Mood = z.object({
  look: z.string().describe("The overall look in two or three sentences"),
  palette: z.array(z.object({ name: z.string(), hex: z.string().describe("#RRGGBB") })).describe("4 to 6 colours"),
  light: z.string(),
  camera: z.string().describe("Lenses, movement, framing"),
  grade: z.string().describe("Colour grade and texture"),
  references: z.array(z.string()),
  do: z.array(z.string()),
  dont: z.array(z.string()),
});
export type Mood = z.infer<typeof Mood>;

type Ctx = {
  brief: unknown;
  stageOne?: unknown;
  path: string | null;
  language: string;
  modelId: string;
  memory?: string[];
  rules?: string[];
  onStep?: (s: Step) => void;
  signal?: AbortSignal;
};

const system = (c: Ctx) => `${MENAB}\n${remembered(c.memory)}${lessons(c.rules)}`;
const base = (c: Ctx) => `Brief: ${JSON.stringify(c.brief)}\nPath: ${c.path ?? "not chosen"}\nStage 1 documents (summary, strategy, pathway): ${JSON.stringify(c.stageOne ?? {})}\nWrite in: ${c.language}.`;

export async function writeDirections(c: Ctx, instruction?: string, current?: unknown) {
  const ask = instruction
    ? `Revise these creative directions with this change from the producer: "${instruction}". Keep what was not asked to change.\nCurrent: ${JSON.stringify(current)}`
    : "Propose three creative directions for this video. Each must be a real idea a Saudi audience would feel, not a template. Keep the brief's mandatories (product, logo, line, people). Stay within the length and the path.";
  return structured(c.modelId, system(c), [{ role: "user", content: `${ask}\n\n${base(c)}` }], Directions, { effort: "medium", maxTokens: 6000, onStep: c.onStep, signal: c.signal, timeoutMs: 100_000 });
}

export async function writeScript(c: Ctx & { direction: unknown; notes: string; seconds: number }, instruction?: string, current?: unknown) {
  const ask = instruction
    ? `Revise this AV script with this change from the producer: "${instruction}". Keep the rest. The rows must still add up to ${c.seconds} seconds.\nCurrent: ${JSON.stringify(current)}`
    : `Write the AV script for the main film from the chosen direction. It must last exactly ${c.seconds} seconds: the seconds of all rows add up to ${c.seconds}. Voiceover and dialogue in natural Saudi dialect Arabic (not formal Arabic), with an English line beside each. A VO line must fit its row: about 2 to 2.5 Arabic words per second. Show the product and the mandatories. End with the logo and line.`;
  return structured(
    c.modelId,
    system(c),
    [{ role: "user", content: `${ask}\n\nChosen direction: ${JSON.stringify(c.direction)}\nNotes from the creative meeting: ${c.notes || "none"}\n\n${base(c)}` }],
    Script,
    { effort: "medium", maxTokens: 6000, onStep: c.onStep, signal: c.signal, timeoutMs: 100_000 },
  );
}

export async function writeTreatment(c: Ctx & { direction: unknown; notes: string; script: unknown }, instruction?: string, current?: unknown) {
  const ask = instruction
    ? `Revise this director's treatment with this change from the producer: "${instruction}". Keep the rest.\nCurrent: ${JSON.stringify(current)}`
    : "Write the director's treatment: the idea, tone and references, then shot by shot frames that follow the script (shot size, what we see, the VO), cast with a Plan A and Plan B for each role, wardrobe per character, location options, and art direction per space. Never include national ID or iqama numbers.";
  return structured(
    c.modelId,
    system(c),
    [{ role: "user", content: `${ask}\n\nChosen direction: ${JSON.stringify(c.direction)}\nMeeting notes: ${c.notes || "none"}\nScript: ${JSON.stringify(c.script)}\n\n${base(c)}` }],
    Treatment,
    { effort: "medium", maxTokens: 8000, onStep: c.onStep, signal: c.signal, timeoutMs: 120_000 },
  );
}

export async function writeMood(c: Ctx & { direction: unknown; notes: string; script: unknown }, instruction?: string, current?: unknown) {
  const ask = instruction
    ? `Revise this visual mood with this change from the producer: "${instruction}". Keep the rest.\nCurrent: ${JSON.stringify(current)}`
    : "Write the visual mood: the look, a colour palette of 4 to 6 colours with hex codes, light, camera language, grade and texture, references, and short lists of do and don't.";
  return structured(
    c.modelId,
    system(c),
    [{ role: "user", content: `${ask}\n\nChosen direction: ${JSON.stringify(c.direction)}\nMeeting notes: ${c.notes || "none"}\nScript: ${JSON.stringify(c.script)}\n\n${base(c)}` }],
    Mood,
    { effort: "low", maxTokens: 4000, onStep: c.onStep, signal: c.signal, timeoutMs: 90_000 },
  );
}

// The script must land within 2 seconds of the length (mvp-definition.md, M3). If the model
// is off, the rows are scaled to fit, keeping each row at least one second.
export function fitScript(s: Script, seconds: number): Script {
  const total = s.rows.reduce((n, r) => n + (Number(r.seconds) || 0), 0);
  if (!s.rows.length || Math.abs(total - seconds) <= 2 || total <= 0) return s;
  const k = seconds / total;
  const rows = s.rows.map((r) => ({ ...r, seconds: Math.max(1, Math.round((Number(r.seconds) || 0) * k * 2) / 2) }));
  const diff = seconds - rows.reduce((n, r) => n + r.seconds, 0);
  if (rows.length) rows[rows.length - 1].seconds = Math.max(1, rows[rows.length - 1].seconds + diff);
  return { ...s, rows };
}
