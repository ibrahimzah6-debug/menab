import "server-only";
import { z } from "zod";
import { KIE_USD_PER_CREDIT } from "./kie";
import { textModel, type TextModel } from "./catalog";

// How the brain talks to its models. Every writing model runs through Kie.ai: Claude with the
// Anthropic message format, GPT with the OpenAI Responses format. Server only.

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number; seconds: number };

// A file attached to a message: an image or a PDF, sent to the model as-is.
export type Attachment = { mime: string; base64: string; name: string };
export type Msg = { role: "user" | "assistant"; content: string; files?: Attachment[] };

export type Result<T> = { data: T; usage: Usage; model: string; fallbackFrom?: string; firstError?: string };

// What the brain is doing right now, reported to the person while they wait.
export type Step =
  | { kind: "calling"; model: string }
  | { kind: "retrying"; model: string; reason: string }
  | { kind: "switching"; from: string; to: string; reason: string };

type Opts = { effort: "low" | "medium"; maxTokens: number; onStep?: (s: Step) => void; timeoutMs?: number };

const secondsSince = (t: number) => Math.round((Date.now() - t) / 100) / 10;

function estimateCost(m: TextModel, input: number, output: number) {
  return Math.round(((input * m.usdPerMillionIn + output * m.usdPerMillionOut) / 1_000_000) * 10000) / 10000;
}

// The backup when a model fails: Claude falls back to GPT, GPT falls back to Claude.
function backupFor(m: TextModel): string {
  return m.provider === "kie-claude" ? "gpt-6-1-sol" : "claude-sonnet-5-5";
}

// Rules from CLAUDE.md: retry once, then switch to the backup. The caller logs which model answered.
// The retry tells the model what was wrong with its first answer.
export async function structured<S extends z.ZodType>(
  modelId: string,
  system: string,
  messages: Msg[],
  schema: S,
  opts: Opts,
): Promise<Result<z.infer<S>>> {
  const m = textModel(modelId);
  let firstError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    opts.onStep?.(attempt === 0 ? { kind: "calling", model: m.name } : { kind: "retrying", model: m.name, reason: firstError });
    try {
      return { ...(await once(m, system, messages, schema, opts, attempt ? firstError : "")), model: m.id };
    } catch (e) {
      firstError = e instanceof Error ? e.message : String(e);
      if (/KIE_API_KEY|insufficient|credits/i.test(firstError)) throw e; // account problems: the backup can't help
    }
  }
  const backup = textModel(backupFor(m));
  opts.onStep?.({ kind: "switching", from: m.name, to: backup.name, reason: firstError });
  const r = await once(backup, system, messages, schema, opts, "");
  return { ...r, model: backup.id, fallbackFrom: m.id, firstError };
}

function once<S extends z.ZodType>(m: TextModel, system: string, messages: Msg[], schema: S, opts: Opts, problem: string) {
  const sys = problem ? `${system}\n\nYour previous answer could not be used (${problem}). Answer again, filling every field with the right type.` : system;
  if (m.provider === "kie-gpt") return kieGpt(m, sys, messages, schema, opts);
  return kieClaude(m, sys, messages, schema, opts);
}

function jsonSchema(schema: z.ZodType) {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

type JS = { type?: string | string[]; anyOf?: JS[]; properties?: Record<string, JS>; items?: JS; enum?: unknown[] };

// Models sometimes send an array as a JSON string, a number as text, or leave out an empty
// field. Bring the answer into shape before it is checked, so a small slip is not a failure.
function coerce(v: unknown, s: JS | undefined): unknown {
  if (!s) return v;
  const options = s.anyOf ?? [s];
  const nullable = options.some((o) => o.type === "null");
  const main = options.find((o) => o.type !== "null") ?? s;
  if (v === undefined || v === "") {
    if (nullable) return null;
    if (main.type === "array") return [];
    if (main.type === "string" && v === undefined) return "";
  }
  if (v === null) return nullable ? null : main.type === "array" ? [] : main.type === "string" ? "" : v;
  if (typeof v === "string" && (main.type === "array" || main.type === "object")) {
    try {
      v = JSON.parse(v);
    } catch {
      if (main.type === "array") v = v ? (v as string).split(/\n+/).map((x) => x.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim()).filter(Boolean) : [];
    }
  }
  if (typeof v === "string" && (main.type === "number" || main.type === "integer")) {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && v.trim() ? n : nullable ? null : v;
  }
  if (typeof v === "string" && main.enum && !main.enum.includes(v)) {
    const lower = v.toLowerCase().trim();
    const hit = main.enum.find((e) => String(e).toLowerCase() === lower);
    if (hit !== undefined) return hit;
    if (nullable) return null;
    if (main.enum.includes("unknown")) return "unknown";
  }
  if (Array.isArray(v) && main.items) return v.map((x) => coerce(x, main.items));
  if (v && typeof v === "object" && !Array.isArray(v) && main.properties) {
    const out: Record<string, unknown> = { ...(v as Record<string, unknown>) };
    for (const [k, ps] of Object.entries(main.properties)) out[k] = coerce(out[k], ps);
    return out;
  }
  return v;
}

function check<S extends z.ZodType>(m: TextModel, schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(coerce(raw, jsonSchema(schema) as JS));
  if (parsed.success) return parsed.data as z.infer<S>;
  const where = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "answer"}: ${i.message}`).join("; ");
  throw new Error(`${m.name} returned an incomplete answer (${where})`);
}

function parseJsonText(text: string) {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : t.slice(Math.max(0, t.indexOf("{")), t.lastIndexOf("}") + 1);
  return JSON.parse(body);
}

async function post(url: string, payload: unknown, opts: Opts, name: string) {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY is not set in Vercel");
  try {
    return await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 75_000),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new Error(`${name} took too long to answer`);
    throw new Error(`${name} could not be reached`);
  }
}

// Claude through Kie.ai: the Anthropic message format at api.kie.ai/claude/v1/messages.
// The answer comes back through one "submit" tool, checked against the schema.
async function kieClaude<S extends z.ZodType>(m: TextModel, system: string, messages: Msg[], schema: S, opts: Opts) {
  const started = Date.now();
  const res = await post(
    "https://api.kie.ai/claude/v1/messages",
    {
      model: m.id,
      max_tokens: opts.maxTokens,
      stream: false,
      system: `${system}\n\nAlways answer by calling the submit tool exactly once, with every field filled.`,
      tools: [{ name: "submit", description: "Submit your complete answer.", input_schema: jsonSchema(schema) }],
      messages: messages.map((x) => ({
        role: x.role,
        content: x.files?.length
          ? [
              ...x.files.map((f) =>
                f.mime === "application/pdf"
                  ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } }
                  : { type: "image", source: { type: "base64", media_type: f.mime, data: f.base64 } },
              ),
              { type: "text", text: x.content },
            ]
          : x.content,
      })),
    },
    opts,
    m.name,
  );
  const body = (await res.json().catch(() => null)) as {
    code?: number;
    msg?: string;
    error?: { message?: string };
    stop_reason?: string;
    content?: { type: string; name?: string; input?: unknown; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    credits_consumed?: number;
  } | null;
  if (!res.ok || !body || (typeof body.code === "number" && body.code !== 200) || body.error) {
    throw new Error(`${m.name}: ${body?.msg ?? body?.error?.message ?? `HTTP ${res.status}`}`);
  }
  if (body.stop_reason === "refusal") throw new Error(`${m.name} declined this request`);
  if (body.stop_reason === "max_tokens") throw new Error(`${m.name} ran out of room before finishing`);
  const tool = body.content?.find((b) => b.type === "tool_use");
  let raw: unknown = tool?.input;
  if (!raw) {
    const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      raw = parseJsonText(text);
    } catch {
      throw new Error(`${m.name} answered without the required format`);
    }
  }
  const data = check(m, schema, raw);
  const input = body.usage?.input_tokens ?? 0;
  const output = body.usage?.output_tokens ?? 0;
  const costUsd = typeof body.credits_consumed === "number"
    ? Math.round(body.credits_consumed * KIE_USD_PER_CREDIT * 10000) / 10000
    : estimateCost(m, input, output);
  return { data, usage: { inputTokens: input, outputTokens: output, costUsd, seconds: secondsSince(started) } };
}

// GPT through Kie.ai: the OpenAI Responses format at api.kie.ai/codex/v1/responses,
// with the answer shaped by a JSON schema.
async function kieGpt<S extends z.ZodType>(m: TextModel, system: string, messages: Msg[], schema: S, opts: Opts) {
  const started = Date.now();
  const res = await post(
    "https://api.kie.ai/codex/v1/responses",
    {
      model: m.id,
      stream: false,
      reasoning: { effort: opts.effort },
      text: { format: { type: "json_schema", name: "answer", strict: false, schema: jsonSchema(schema) } },
      input: [
        { role: "system", content: [{ type: "input_text", text: `${system}\n\nAnswer only with JSON that follows the schema.` }] },
        ...messages.map((x) =>
          x.role === "assistant"
            ? { role: "assistant", content: [{ type: "output_text", text: x.content }] }
            : {
                role: "user",
                content: [
                  ...(x.files ?? [])
                    .filter((f) => f.mime.startsWith("image/"))
                    .map((f) => ({ type: "input_image", image_url: `data:${f.mime};base64,${f.base64}` })),
                  { type: "input_text", text: x.content },
                ],
              },
        ),
      ],
    },
    opts,
    m.name,
  );
  const body = (await res.json().catch(() => null)) as {
    code?: number;
    msg?: string;
    error?: { message?: string } | null;
    status?: string;
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    credits_consumed?: number;
  } | null;
  if (!res.ok || !body || (typeof body.code === "number" && body.code !== 200) || body.error) {
    throw new Error(`${m.name}: ${body?.msg ?? body?.error?.message ?? `HTTP ${res.status}`}`);
  }
  if (body.status && body.status !== "completed") throw new Error(`${m.name} stopped before finishing (${body.status})`);
  const text = (body.output ?? [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("");
  let raw: unknown;
  try {
    raw = parseJsonText(text);
  } catch {
    throw new Error(`${m.name} answered without the required format`);
  }
  const data = check(m, schema, raw);
  const input = body.usage?.input_tokens ?? 0;
  const output = body.usage?.output_tokens ?? 0;
  const costUsd = typeof body.credits_consumed === "number"
    ? Math.round(body.credits_consumed * KIE_USD_PER_CREDIT * 10000) / 10000
    : estimateCost(m, input, output);
  return { data, usage: { inputTokens: input, outputTokens: output, costUsd, seconds: secondsSince(started) } };
}
