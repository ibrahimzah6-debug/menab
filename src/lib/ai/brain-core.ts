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

type Opts = {
  effort: "low" | "medium";
  maxTokens: number;
  onStep?: (s: Step) => void;
  timeoutMs?: number;
  // The person pressed Stop: every call ends at once and nothing is retried.
  signal?: AbortSignal;
};

export class StoppedError extends Error {
  constructor() {
    super("Stopped");
  }
}


const secondsSince = (t: number) => Math.round((Date.now() - t) / 100) / 10;

function estimateCost(m: TextModel, input: number, output: number) {
  return Math.round(((input * m.usdPerMillionIn + output * m.usdPerMillionOut) / 1_000_000) * 10000) / 10000;
}

// The backup when a model fails: Claude falls back to GPT, GPT falls back to Claude.
// The nearest model from the other family, by strength and price.
const NEAREST: Record<string, string> = {
  "claude-fable-5": "gpt-6-astra",
  "claude-opus-5-5": "gpt-6-1-sol",
  "claude-sonnet-5-5": "gpt-6-1-terra",
  "claude-haiku-5-5": "gpt-6-luna",
  "gpt-6-astra": "claude-fable-5",
  "gpt-6-1-sol": "claude-opus-5-5",
  "gpt-6-1-terra": "claude-sonnet-5-5",
  "gpt-6-luna": "claude-haiku-5-5",
};
export function backupFor(m: TextModel): string {
  return NEAREST[m.id] ?? (m.provider === "kie-claude" ? "gpt-6-1-sol" : "claude-opus-5-5");
}

// A model that is not answering at all (busy, internal error, no first reply in time) gets
// no second try: the nearest model answers at once. A model that answered but sent something
// unusable gets one more try, since it is working.
const NOT_ANSWERING = /tight|busy|overload|internal|try again|not answering|could not be reached|took too long|HTTP 5\d\d/i;

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
      if (opts.signal?.aborted) throw new StoppedError();
      firstError = e instanceof Error ? e.message : String(e);
      if (/KIE_API_KEY|insufficient|credits/i.test(firstError)) throw e; // account problems: the backup can't help
      if (NOT_ANSWERING.test(firstError)) break;
    }
  }
  if (opts.signal?.aborted) throw new StoppedError();
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
      signal: opts.signal ? AbortSignal.any([AbortSignal.timeout(opts.timeoutMs ?? 75_000), opts.signal]) : AbortSignal.timeout(opts.timeoutMs ?? 75_000),
    });
  } catch (e) {
    if (opts.signal?.aborted) throw new StoppedError();
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new Error(`${name} took too long to answer`);
    throw new Error(`${name} could not be reached`);
  }
}

// Claude through Kie.ai: the Anthropic message format at api.kie.ai/claude/v1/messages.
// The answer comes back through one "submit" tool, checked against the schema.
async function kieClaude<S extends z.ZodType>(m: TextModel, system: string, messages: Msg[], schema: S, opts: Opts) {
  const started = Date.now();
  const payload =
    {
      model: m.id,
      max_tokens: opts.maxTokens,
      // Streaming is Kie.ai's normal mode for Claude and holds up better under load than one
      // long wait; thinking is off for chat turns and on for the documents.
      stream: true,
      thinkingFlag: opts.effort !== "low",
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
    };
  // Claude streams, so a working model starts answering within a second or two. If nothing
  // has started after 4 seconds it is counted as not answering and the nearest model takes over.
  const firstReply = new AbortController();
  const timer = setTimeout(() => firstReply.abort(), 4000);
  let res: Response;
  try {
    res = await post("https://api.kie.ai/claude/v1/messages", payload, { ...opts, signal: opts.signal ? AbortSignal.any([opts.signal, firstReply.signal]) : firstReply.signal }, m.name);
  } catch (e) {
    if (firstReply.signal.aborted && !opts.signal?.aborted) throw new Error(`${m.name} is not answering right now`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const body = await readClaude(res, opts);
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
      // Streamed: Kie.ai's gateway cuts a silent connection after about 30 seconds (HTTP 502),
      // which long documents like the shot list need.
      stream: true,
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
  const body = await readGpt(res, opts);
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

type ClaudeBody = {
  code?: number;
  msg?: string;
  error?: { message?: string };
  stop_reason?: string;
  content?: { type: string; name?: string; input?: unknown; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  credits_consumed?: number;
};

// Reads Claude's answer, streamed (server-sent events) or as one JSON, into one shape.
type GptBody = {
  code?: number;
  msg?: string;
  error?: { message?: string } | null;
  status?: string;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  credits_consumed?: number;
};

// Reads a GPT answer, streamed or not. The stream's last event holds the whole response.
async function readGpt(res: Response, opts: Opts): Promise<GptBody | null> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("event-stream") || !res.body) {
    try {
      return JSON.parse(await res.text()) as GptBody;
    } catch {
      return null;
    }
  }
  let out: GptBody | null = null;
  let text = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (data: string) => {
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof e.code === "number" && e.code !== 200) out = { code: e.code, msg: String(e.msg ?? "") };
    else if (e.type === "response.completed" || e.type === "response.incomplete") {
      out = { ...(e.response as GptBody), credits_consumed: typeof e.credits_consumed === "number" ? e.credits_consumed : undefined };
    } else if (e.type === "response.failed" || e.type === "error") {
      const r = e.response as { error?: { message?: string } } | undefined;
      out = { error: { message: r?.error?.message ?? (e.error as { message?: string } | undefined)?.message ?? (e.message as string | undefined) ?? "failed" } };
    } else if (e.type === "response.output_text.done" && typeof e.text === "string") {
      text += e.text;
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let i: number;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (line.startsWith("data:")) handle(line.slice(5).trim());
      }
    }
    if (buffer.trim().startsWith("data:")) handle(buffer.trim().slice(5).trim());
  } catch (e) {
    if (opts.signal?.aborted) throw new StoppedError();
    throw e;
  }
  // A stream that ended without its last event: use the text it sent, if any.
  return out ?? (text ? { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] } : null);
}

async function readClaude(res: Response, opts: Opts): Promise<ClaudeBody | null> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("event-stream") || !res.body) {
    const raw = await res.text();
    try {
      return JSON.parse(raw) as ClaudeBody;
    } catch {
      return null;
    }
  }
  const out: ClaudeBody = { content: [], usage: {} };
  const blocks: { type: string; name?: string; text: string; json: string }[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handle = (data: string) => {
    let e: Record<string, unknown>;
    try {
      e = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof e.code === "number" && e.code !== 200) Object.assign(out, { code: e.code, msg: e.msg });
    if (e.error) out.error = e.error as ClaudeBody["error"];
    if (typeof e.credits_consumed === "number") out.credits_consumed = e.credits_consumed;
    const t = e.type;
    if (t === "message_start") {
      const u = (e.message as { usage?: ClaudeBody["usage"] })?.usage;
      if (u?.input_tokens) out.usage!.input_tokens = u.input_tokens;
    } else if (t === "content_block_start") {
      const b = e.content_block as { type: string; name?: string; text?: string };
      blocks[e.index as number] = { type: b.type, name: b.name, text: b.text ?? "", json: "" };
    } else if (t === "content_block_delta") {
      const b = blocks[e.index as number];
      const d = e.delta as { type: string; text?: string; partial_json?: string };
      if (!b) return;
      if (d.type === "text_delta") b.text += d.text ?? "";
      if (d.type === "input_json_delta") b.json += d.partial_json ?? "";
    } else if (t === "message_delta") {
      const d = e.delta as { stop_reason?: string };
      if (d?.stop_reason) out.stop_reason = d.stop_reason;
      const u = e.usage as ClaudeBody["usage"];
      if (u?.output_tokens) out.usage!.output_tokens = u.output_tokens;
      if (u?.input_tokens) out.usage!.input_tokens = u.input_tokens;
    }
  };
  for (;;) {
    if (opts.signal?.aborted) {
      reader.cancel().catch(() => {});
      throw new StoppedError();
    }
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.startsWith("data:")) handle(line.slice(5).trim());
  }
  if (buffer.startsWith("data:")) handle(buffer.slice(5).trim());
  out.content = blocks.filter(Boolean).map((b) => {
    if (b.type !== "tool_use") return { type: b.type, text: b.text };
    let input: unknown;
    try {
      input = b.json ? JSON.parse(b.json) : undefined;
    } catch {
      input = undefined;
    }
    return { type: "tool_use", name: b.name, input };
  });
  return out;
}
