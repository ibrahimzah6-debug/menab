import "server-only";
import { z } from "zod";
import { structured, type Msg, type Step } from "./brain-core";

export type { Attachment, Msg, Step, Usage } from "./brain-core";

// The "brain": Menab AI reads the brief and decides what follows, so people are not left
// guessing and nothing is generated before the idea is clear. The calls themselves, with
// retry and backup, live in brain-core.ts.

const MENAB = `You are Menab AI, the production brain inside Menab (مِناب), a Saudi platform that takes a video from a client brief to delivery: made with AI, shot by a production house, or a hybrid of both. You think like a senior Saudi creative producer at a production house in Riyadh: you care first about the idea and how the video will make people feel, then about how to make it well within the time and money.

How you write:
- Plain, warm and direct, like a producer talking to a colleague. Short sentences.
- Answer in the language the user writes in. Arabic answers use everyday Saudi phrasing.
- Never use em dashes. Use a comma, a colon or a new sentence.
- Never invent facts the user did not give. You may propose creative ideas, but mark them as a suggestion.
- Industry words are fine: CPS, PPM, call sheet, treatment, shot list, cutdowns, VO, supers.
- Know the Saudi context: Ramadan, Eid, National Day, Founding Day, family life, Saudi dialects, GAMR rules.

Path rules:
- Production: a real product, real talent or a real location must appear on camera.
- AI: stylized, fantasy or hard-to-film scenes, or a tight budget or very short deadline.
- Hybrid: a real product or person with impossible or costly environments. Choose scene by scene.
The user can always change the path.`;

// ---------- Brief turn ----------

// The brief starts from the video itself (the idea, story and feeling), then delivery,
// production needs, and finally client and timing.
const BriefFields = z.object({
  project_name: z.string().nullable().describe("Short working title, e.g. 'Dalla Ramadan ad'"),
  // The video
  logline: z.string().nullable().describe("The idea of the video in one sentence, as understood so far. Draft it from what was said; mark it as a first draft if the user has not confirmed it."),
  objective: z.string().nullable().describe("What the video must achieve for the client: launch, awareness, sales, recruitment, an occasion"),
  audience: z.string().nullable(),
  story: z.array(z.string()).describe("What happens, as 2 to 6 short beats in order. Empty if unknown."),
  feeling: z.string().nullable().describe("How it should feel: tone, mood, pace, music feeling"),
  key_message: z.string().nullable().describe("The one thing the viewer must remember"),
  must_show: z.array(z.string()).describe("Mandatories: product shots, logo, line, legal text, people"),
  references: z.array(z.string()),
  // Delivery
  length_seconds: z.number().nullable().describe("Main video length in seconds"),
  cutdowns: z.array(z.string()).describe("Extra versions, e.g. '15 sec', '6 sec'"),
  formats: z.array(z.string()).describe("Aspect ratio with where it plays, e.g. '9:16 Instagram', '16:9 TV'"),
  language: z.string().nullable().describe("Voiceover and on-screen language and dialect"),
  // Production
  real_products: z.enum(["yes", "no", "unknown"]).describe("Must the real product appear on camera"),
  real_people: z.enum(["yes", "no", "unknown"]).describe("Must real talent or real people appear"),
  locations: z.array(z.string()),
  // Client and timing
  client: z.string().nullable(),
  product: z.string().nullable(),
  deadline: z.string().nullable().describe("Final delivery date as the user said it"),
  budget: z.string().nullable(),
});
export type BriefFields = z.infer<typeof BriefFields>;

const BriefTurn = z.object({
  reply: z.string().describe("Your chat reply. Short. Reflect back the idea in one line when it changes. Ask your questions here as a numbered list."),
  brief: BriefFields,
  questions: z.array(z.string()).describe("At most 3. First any required field still empty; then the questions that would most improve the video itself (story, feeling, key message)."),
  path: z.object({
    suggested: z.enum(["ai", "production", "hybrid"]).nullable(),
    reason: z.string().describe("One line explaining the suggestion, in the user's language. Empty if not suggested yet."),
  }),
});
export type BriefTurn = z.infer<typeof BriefTurn>;

export const REQUIRED_BRIEF_FIELDS = ["client", "objective", "length_seconds", "formats", "language", "deadline"] as const;

export function missingRequired(b: Partial<BriefFields>) {
  return REQUIRED_BRIEF_FIELDS.filter((k) => {
    const v = b[k];
    return v == null || v === "" || (Array.isArray(v) && v.length === 0);
  });
}

export async function briefTurn(
  history: Msg[],
  current: Partial<BriefFields>,
  modelId: string,
  onStep?: (s: Step) => void,
) {
  const r = await structured(
    modelId,
    `${MENAB}

Your job now: run the brief conversation. Turn what the user says into a structured brief that starts from the video itself: the idea in one line, the story beats, the feeling and the key message. Then delivery, production needs, client and timing. Keep values the user gave earlier unless they change them, and when they change the idea (for example a different character or place), update the logline and story beats to match. You may draft the logline and story beats from what you heard, as a first draft for the user to confirm.

Required before documents can be written: ${REQUIRED_BRIEF_FIELDS.join(", ")}. Ask for those first. When they are filled, ask what would most improve the video. Never more than 3 questions at a time. Budget is optional: never insist on it. Suggest a path as soon as you know whether real products or people must be on camera.`,
    [
      ...history,
      {
        role: "user",
        content: `Brief so far (JSON, may be empty): ${JSON.stringify(current)}\nUpdate it from the conversation above and answer my last message.`,
      },
    ],
    BriefTurn,
    { effort: "low", maxTokens: 8000, onStep, timeoutMs: 70_000 },
  );
  r.data.questions = r.data.questions.slice(0, 3);
  return { turn: r.data, usage: r.usage, model: r.model, fallbackFrom: r.fallbackFrom, firstError: r.firstError };
}

// ---------- Stage 1 documents (outputs 3 to 6) ----------

const StageOneDocs = z.object({
  summary: z.object({
    title: z.string(),
    paragraphs: z.array(z.string()).describe("The brief written for sign-off, 2 to 4 short paragraphs, starting with the idea"),
  }),
  strategy: z.object({
    insight: z.string().describe("A human truth the idea is built on, specific to the audience"),
    key_message: z.string(),
    tone: z.string(),
    platforms: z.array(z.string()),
    deliverables: z.array(
      z.object({
        name: z.string(),
        duration_seconds: z.number(),
        ratio: z.string(),
        platform: z.string(),
      }),
    ),
  }),
  pathway: z.object({
    path: z.enum(["ai", "production", "hybrid"]),
    reason: z.string(),
    ai_scenes: z.array(z.string()).describe("Scenes best made with AI"),
    shoot_scenes: z.array(z.string()).describe("Scenes best shot for real"),
    cost_range: z.string().describe("A rough range in SAR or USD with what it covers, labelled as an estimate"),
    time_range: z.string(),
  }),
  cps: z.object({
    milestones: z.array(
      z.object({
        name: z.string().describe("e.g. Brief and products received, Kickoff, Creative, Creative meeting, Approval, PPM, Recce, Shoot day 1, Editing, Offline delivery, Client feedback, Offline lock, Grade, Final delivery, Cutdowns"),
        start: z.string().describe("YYYY-MM-DD"),
        end: z.string().describe("YYYY-MM-DD"),
        phase: z.enum(["pre", "production", "post"]),
      }),
    ),
    note: z.string().describe("Always say final delivery depends on the number of revision rounds"),
  }),
  kickoff_notes: z.array(z.string()).describe("Open points and next steps for the kickoff meeting"),
});
export type StageOneDocs = z.infer<typeof StageOneDocs>;

// Writes outputs 3 to 6. With an instruction ("make it the father going to the supermarket"),
// it revises the current documents and the brief idea instead of starting over.
export async function writeStageOne(
  brief: BriefFields,
  path: string | null,
  today: string,
  language: string,
  modelId: string,
  revise?: { instruction: string; current: unknown },
  onStep?: (s: Step) => void,
) {
  const ask = revise
    ? `Today is ${today}. Revise these stage 1 documents with this change from the producer: "${revise.instruction}". Apply the change everywhere it matters (summary, strategy, pathway, CPS) and keep everything else. Write in: ${language}.

Current documents: ${JSON.stringify(revise.current)}`
    : `Today is ${today}. Write the stage 1 documents for this brief: the brief summary for sign-off (start from the idea), strategy and deliverables (with every cutdown and ratio), the pathway with a rough cost and time range, and a first CPS. The CPS weeks run Sunday to Saturday, as in Saudi. Work back from the deadline; if the deadline is tight, say so in the note. Write in: ${language}.`;
  const r = await structured(
    modelId,
    MENAB,
    [
      {
        role: "user",
        content: `${ask}

Path chosen by the user: ${path ?? "not chosen, suggest one"}
Brief: ${JSON.stringify(brief)}`,
      },
    ],
    StageOneDocs,
    { effort: "medium", maxTokens: 16000, onStep, timeoutMs: 90_000 },
  );
  return { docs: r.data, usage: r.usage, model: r.model, fallbackFrom: r.fallbackFrom, firstError: r.firstError };
}
