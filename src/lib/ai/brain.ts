import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BRAIN } from "./catalog";

// The "brain": Claude reads the brief and decides everything that follows, so users
// are not left guessing and nothing is generated before the brief is clear.
// Server only. Every call returns its token use and real cost for the AI job log.

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in Vercel");
  client ??= new Anthropic();
  return client;
}

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number; seconds: number };

function usageOf(u: { input_tokens: number; output_tokens: number }, started: number): Usage {
  const costUsd = (u.input_tokens * BRAIN.usdPerMillionIn + u.output_tokens * BRAIN.usdPerMillionOut) / 1_000_000;
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    costUsd: Math.round(costUsd * 10000) / 10000,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
}

const MENAB = `You are Menab AI, the production brain inside Menab (مِناب), a Saudi platform that takes a video from a client brief to delivery: made with AI, shot by a production house, or a hybrid of both. You work like a senior Saudi producer at a production house in Riyadh.

How you write:
- Plain, warm and direct, like a producer talking to a colleague. Short sentences.
- Answer in the language the user writes in. Arabic answers use everyday Saudi phrasing.
- Never use em dashes. Use a comma, a colon or a new sentence.
- Never invent facts the user did not give. Leave a field empty when it is unknown.
- Industry words are fine: CPS, PPM, call sheet, treatment, shot list, cutdowns.

Path rules:
- Production: real product, real talent or a real location must appear on camera.
- AI: stylized, fantasy or hard-to-film scenes, or a tight budget or very short deadline.
- Hybrid: a real product or person with impossible or costly environments. Choose scene by scene.
The user can always change the path.`;

// ---------- Brief turn ----------

const BriefFields = z.object({
  project_name: z.string().nullable().describe("Short working title for the project, e.g. 'Ninja Ramadan ad'"),
  client: z.string().nullable(),
  product: z.string().nullable(),
  goal: z.string().nullable().describe("What the video must achieve, one sentence"),
  audience: z.string().nullable(),
  length_seconds: z.number().nullable().describe("Main video length in seconds"),
  cutdowns: z.array(z.string()).describe("Extra versions, e.g. '15 sec', '6 sec'"),
  formats: z.array(z.string()).describe("Aspect ratio with where it plays, e.g. '9:16 Instagram', '16:9 TV'"),
  language: z.string().nullable().describe("Voiceover and on-screen language, e.g. 'Arabic (Saudi), English later'"),
  real_products: z.enum(["yes", "no", "unknown"]).describe("Must the real product appear on camera"),
  real_people: z.enum(["yes", "no", "unknown"]).describe("Must real talent or real people appear"),
  locations: z.array(z.string()),
  deadline: z.string().nullable().describe("Final delivery date as the user said it"),
  budget: z.string().nullable(),
  mandatories: z.array(z.string()).describe("Things that must be in the video: logo, line, product shot, legal text"),
  references: z.array(z.string()),
});
export type BriefFields = z.infer<typeof BriefFields>;

const BriefTurn = z.object({
  reply: z.string().describe("Your chat reply to the user. Short. If questions remain, ask them as a numbered list here too."),
  brief: BriefFields,
  questions: z.array(z.string()).describe("Only for required fields still empty. Never more than 3, most important first."),
  path: z.object({
    suggested: z.enum(["ai", "production", "hybrid"]).nullable(),
    reason: z.string().describe("One line explaining the suggestion, in the user's language. Empty if not suggested yet."),
  }),
});
export type BriefTurn = z.infer<typeof BriefTurn>;

export const REQUIRED_BRIEF_FIELDS = ["client", "goal", "length_seconds", "formats", "language", "deadline"] as const;

export function missingRequired(b: Partial<BriefFields>) {
  return REQUIRED_BRIEF_FIELDS.filter((k) => {
    const v = b[k];
    return v == null || v === "" || (Array.isArray(v) && v.length === 0);
  });
}

export async function briefTurn(
  history: { role: "user" | "assistant"; content: string }[],
  current: Partial<BriefFields>,
) {
  const started = Date.now();
  const res = await anthropic().beta.messages.parse({
    model: BRAIN.model,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      {
        type: "text",
        text: `${MENAB}

Your job now: turn the conversation into a structured brief. Fill every field you can from what the user said. Keep values the user gave earlier unless they change them. Required before the brief can be approved: ${REQUIRED_BRIEF_FIELDS.join(", ")}. Ask only for required fields that are still empty, at most 3 questions at a time. Budget is optional: never insist on it. Suggest a path as soon as you know whether real products or people must be on camera.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      ...history,
      {
        role: "user",
        content: `Brief so far (JSON, may be empty): ${JSON.stringify(current)}\nUpdate it from the conversation above and answer my last message.`,
      },
    ],
    output_config: { effort: "low", format: betaZodOutputFormat(BriefTurn) },
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error("Menab AI could not read that brief. Try saying it another way.");
  }
  const turn = res.parsed_output;
  turn.questions = turn.questions.slice(0, 3);
  return { turn, usage: usageOf(res.usage, started) };
}

// ---------- Stage 1 documents (outputs 3 to 6) ----------

const StageOneDocs = z.object({
  summary: z.object({
    title: z.string(),
    paragraphs: z.array(z.string()).describe("The brief written for sign-off, 2 to 4 short paragraphs"),
  }),
  strategy: z.object({
    insight: z.string(),
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
        name: z.string().describe("e.g. Brief and products received, Kickoff, Creative, Creative meeting, PPM, Shoot day 1, Offline delivery, Final delivery, Cutdowns"),
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

export async function writeStageOne(brief: BriefFields, path: string | null, today: string, language: string) {
  const started = Date.now();
  const res = await anthropic().beta.messages.parse({
    model: BRAIN.model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: MENAB, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Today is ${today}. Write the stage 1 documents for this approved brief: the brief summary for sign-off, strategy and deliverables (with every cutdown and ratio), the pathway with a rough cost and time range, and a first CPS. The CPS weeks run Sunday to Saturday, as in Saudi. Work back from the deadline; if the deadline is tight, say so in the note. Write in: ${language}.

Path chosen by the user: ${path ?? "not chosen, suggest one"}
Brief: ${JSON.stringify(brief)}`,
      },
    ],
    output_config: { effort: "medium", format: betaZodOutputFormat(StageOneDocs) },
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error("Menab AI could not write the documents. Try again.");
  }
  return { docs: res.parsed_output, usage: usageOf(res.usage, started) };
}

// Rough prices shown before each action. Real costs are recorded after.
export const ESTIMATE = { briefTurn: 0.03, stageOne: 0.12 } as const;
