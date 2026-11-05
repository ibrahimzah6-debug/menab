import "server-only";
import { z } from "zod";
import { KIE_USD_PER_CREDIT } from "./kie";
import { textModel, type TextModel } from "./catalog";

// How the brain talks to its models. Every writing model runs through Kie.ai, except the
// free Gemini, which uses Google's own API with Menab's key. Server only.

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number; seconds: number };

// A file attached to a message: an image or a PDF, sent to the model as-is.
export type Attachment = { mime: string; base64: string; name: string };
export type Msg = { role: "user" | "assistant"; content: string; files?: Attachment[] };

export type Result<T> = { data: T; usage: Usage; model: string; fallbackFrom?: string; firstError?: string };

type Opts = { effort: "low" | "medium"; maxTokens: number };

const secondsSince = (t: number) => Math.round((Date.now() - t) / 100) / 10;

function estimateCost(m: TextModel, input: number, output: number) {
  return Math.round(((input * m.usdPerMillionIn + output * m.usdPerMillionOut) / 1_000_000) * 10000) / 10000;
}

// The backup when a model fails: Claude models fall back to the free Gemini (or Gemini 4 Argon
// when there is no Google key); Gemini models fall back to Claude Sonnet.
function backupFor(m: TextModel): string | null {
  if (m.provider === "kie-claude") return process.env.GEMINI_API_KEY ? "gemini-3.8-flash" : "gemini-4-argon";
  return process.env.KIE_API_KEY ? "claude-sonnet-5-5" : null;
}

// Rules from CLAUDE.md: retry once, then switch to the backup. The caller logs which model answered.
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
    try {
      return { ...(await once(m, system, messages, schema, opts)), model: m.id };
    } catch (e) {
      firstError = e instanceof Error ? e.message : String(e);
    }
  }
  const backupId = backupFor(m);
  if (!backupId || backupId === m.id) throw new Error(firstError);
  const backup = textModel(backupId);
  const r = await once(backup, system, messages, schema, opts);
  return { ...r, model: backup.id, fallbackFrom: m.id, firstError };
}

function once<S extends z.ZodType>(m: TextModel, system: string, messages: Msg[], schema: S, opts: Opts) {
  if (m.provider === "kie-claude") return kieClaude(m, system, messages, schema, opts);
  if (m.provider === "kie-gemini") return geminiCall(m, system, messages, schema, "kie");
  return geminiCall(m, system, messages, schema, "google");
}

function jsonSchema(schema: z.ZodType) {
  const s = z.toJSONSchema(schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

// Claude through Kie.ai: the Anthropic message format at api.kie.ai/claude/v1/messages.
// The answer comes back through one "submit" tool, checked against the schema.
async function kieClaude<S extends z.ZodType>(m: TextModel, system: string, messages: Msg[], schema: S, opts: Opts) {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY is not set in Vercel");
  const started = Date.now();
  const res = await fetch("https://api.kie.ai/claude/v1/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      model: m.id,
      max_tokens: opts.maxTokens,
      stream: false,
      system: `${system}\n\nAlways answer by calling the submit tool exactly once, with every required field.`,
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
    }),
  });
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
    throw new Error(`Kie.ai ${m.name}: ${body?.msg ?? body?.error?.message ?? `HTTP ${res.status}`}`);
  }
  if (body.stop_reason === "refusal") throw new Error(`${m.name} declined this request`);
  const tool = body.content?.find((b) => b.type === "tool_use" && b.name === "submit");
  let raw: unknown = tool?.input;
  if (!raw) {
    // Some answers arrive as JSON text instead of a tool call.
    const text = (body.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    try {
      raw = JSON.parse(text.replace(/^[\s\S]*?```(json)?|```[\s\S]*$/g, "").trim() || text);
    } catch {
      throw new Error(`${m.name} did not return a complete answer`);
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error(`${m.name} returned an incomplete answer`);
  const input = body.usage?.input_tokens ?? 0;
  const output = body.usage?.output_tokens ?? 0;
  const costUsd = typeof body.credits_consumed === "number"
    ? Math.round(body.credits_consumed * KIE_USD_PER_CREDIT * 10000) / 10000
    : estimateCost(m, input, output);
  return { data: parsed.data as z.infer<S>, usage: { inputTokens: input, outputTokens: output, costUsd, seconds: secondsSince(started) } };
}

// Gemini: Google's API (free tier, Menab's key) or through Kie.ai. Same native format.
async function geminiCall<S extends z.ZodType>(m: TextModel, system: string, messages: Msg[], schema: S, via: "google" | "kie") {
  const started = Date.now();
  const key = via === "google" ? process.env.GEMINI_API_KEY : process.env.KIE_API_KEY;
  if (!key) throw new Error(via === "google" ? "GEMINI_API_KEY is not set in Vercel" : "KIE_API_KEY is not set in Vercel");
  const url =
    via === "google"
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m.id)}:generateContent`
      : `https://api.kie.ai/gemini/v1/models/${encodeURIComponent(m.id)}:streamGenerateContent`;
  const headers: Record<string, string> =
    via === "google" ? { "x-goog-api-key": key, "Content-Type": "application/json" } : { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const body = (withSchema: boolean) => ({
    ...(via === "kie" ? { stream: false } : {}),
    systemInstruction: {
      parts: [{ text: withSchema ? system : `${system}\n\nAnswer only with JSON matching this schema:\n${JSON.stringify(jsonSchema(schema))}` }],
    },
    contents: messages.map((x) => ({
      role: x.role === "assistant" ? "model" : "user",
      parts: [...(x.files ?? []).map((f) => ({ inline_data: { mime_type: f.mime, data: f.base64 } })), { text: x.content }],
    })),
    generationConfig: {
      responseMimeType: "application/json",
      ...(withSchema ? { responseJsonSchema: jsonSchema(schema) } : {}),
    },
  });
  const call = (withSchema: boolean) => fetch(url, { method: "POST", headers, cache: "no-store", body: JSON.stringify(body(withSchema)) });
  let res = await call(true);
  // Some schemas are too rich for the schema mode: ask again with the schema in the instructions.
  if (res.status === 400) res = await call(false);
  const raw = await res.text();
  let chunks: unknown[];
  try {
    const j = JSON.parse(raw);
    chunks = Array.isArray(j) ? j : [j];
  } catch {
    chunks = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } }).filter(Boolean);
  }
  type Chunk = {
    code?: number;
    msg?: string;
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const list = chunks as Chunk[];
  const err = list.find((c) => c?.error || (typeof c?.code === "number" && c.code !== 200));
  if (!res.ok || err || !list.length) {
    if (res.status === 429) throw new Error("The free Gemini limit is used up for now. Try again later or pick another model.");
    throw new Error(`${m.name}: ${err?.error?.message ?? err?.msg ?? `HTTP ${res.status}`}`);
  }
  const text = list.flatMap((c) => c?.candidates?.[0]?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
  } catch {
    throw new Error(`${m.name} did not return a complete answer`);
  }
  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) throw new Error(`${m.name} returned an incomplete answer`);
  const usage = [...list].reverse().find((c) => c?.usageMetadata)?.usageMetadata;
  const input = usage?.promptTokenCount ?? 0;
  const output = usage?.candidatesTokenCount ?? 0;
  return {
    data: parsed.data as z.infer<S>,
    usage: { inputTokens: input, outputTokens: output, costUsd: m.free ? 0 : estimateCost(m, input, output), seconds: secondsSince(started) },
  };
}
