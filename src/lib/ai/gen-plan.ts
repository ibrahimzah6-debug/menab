import "server-only";
import { z } from "zod";
import { MENAB } from "./brain";
import { structured, type Attachment, type Step } from "./brain-core";

// The stage 5 assistant: reads what the producer asks (and any photos attached) and proposes a
// short list of actions from a fixed menu. Nothing runs here: the producer sees the list with
// prices and presses Apply. The AI never invents a kind of action outside this menu.

export const GenAction = z.object({
  type: z.enum(["voice", "skip", "addBack", "productPhotos", "product", "remakeSheet", "remakeKeyframe", "remakeClip", "remakeVoice", "remakeMusic", "aspect"]),
  // Who or what it is about: a character name, "narrator", a product name, a shot number, or a part ("narrator", "music", "products").
  target: z.string().describe("Character name, 'narrator', product name, shot number, or the part to skip or add back"),
  // Voice changes: any of these may be set.
  voice: z.string().nullable().describe("Gemini voice id from the list, or null"),
  dialect: z.string().nullable().describe("Dialect id from the list, or null"),
  age: z.string().nullable().describe("Age id from the list, or null"),
  how: z.string().nullable().describe("How it sounds, short, in English, or null"),
  // Product: name and look; photos: which attached files (0-based) are photos of the product.
  description: z.string().nullable().describe("Product description, or the change for a keyframe, or the new video instructions for a clip, in English"),
  files: z.array(z.number().int()).nullable().describe("Attached file numbers (0-based) that are product photos, or null"),
  // The frame shape, only for "aspect".
  aspect: z.enum(["16:9", "9:16", "1:1"]).nullable(),
  // One plain sentence for the producer, in their language.
  say: z.string().describe("What this action does, one short plain sentence in the producer's language"),
});
export const GenPlan = z.object({
  reply: z.string().describe("One or two short plain sentences to the producer, in their language, saying what you suggest. Nothing has happened yet: never say it is done"),
  actions: z.array(GenAction).max(12),
});
export type GenPlan = z.infer<typeof GenPlan>;

export async function planGenerate(c: {
  modelId: string;
  language: string;
  request: string;
  files: Attachment[];
  state: unknown;
  onStep?: (s: Step) => void;
}) {
  const ask = `The producer is in stage 5 (Generate) of a video and asks: "${c.request}"
${c.files.length ? `They attached ${c.files.length} file(s), numbered from 0: ${c.files.map((f, i) => `${i}: ${f.name}`).join(", ")}.` : "No files attached."}

Propose the fewest actions from the menu that do exactly what they ask. Rules:
- voice: change a character's (target = name) or the narrator's (target = "narrator") voice, dialect, age or how it sounds. Use only ids from the lists.
- skip / addBack: target is "narrator", "music" or "products".
- productPhotos: attached files that show the product (files = their numbers); target = product name.
- product: set or change a product's name or description (target = product name, description = how it looks).
- remakeSheet: make a character's digital actor sheet again (target = name). Only before the lock.
- remakeKeyframe: make a shot's keyframe again (target = shot number); description = the change in English.
- remakeClip: make a shot's video again (target = shot number); description = the full new video instructions in English, keeping what should stay.
- remakeVoice: make a line again (target = the line key, like "vo-1" or "dl-3").
- remakeMusic: make the music again.
- aspect: change the frame shape. Only before the lock.
If a picture would change, also remake what depends on it only when the producer asks for the result (for example a new keyframe and then its clip).
If the request cannot be done with this menu, return no actions and say so plainly in reply.
Never include national ID or iqama numbers.

Current state of the step (characters, voices, products, shots, what is made, what is skipped, whether it is locked):
${JSON.stringify(c.state)}

Nothing runs until the producer presses Apply, so never say a change is done. Write "reply" and every "say" in: ${c.language}.`;
  return structured(c.modelId, MENAB, [{ role: "user", content: ask, files: c.files }], GenPlan, { effort: "low", maxTokens: 3000, onStep: c.onStep, timeoutMs: 90_000 });
}
