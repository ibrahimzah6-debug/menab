import "server-only";

// Voice notes to text with Google's own Gemini API and Menab's free key (GEMINI_API_KEY in
// Vercel). No Kie.ai here (Ibrahim, 6 Nov 2026).
//
// First choice: Gemini 3.5 Transcribe, Google's dedicated low-latency speech-to-text model,
// in "smart" mode (punctuation, no filler words), any language and code-switching, Arabic and
// English included. If Google is busy, the lightest general models try next.
// On the free tier Google may use the content to improve its models (Ibrahim accepted this).

const PROMPT =
  "Transcribe this voice note exactly as spoken. It is a video production brief, usually in Saudi Arabic, sometimes mixed with English. Keep the original language and words. Return only the transcript, no notes.";

const API = "https://generativelanguage.googleapis.com/v1beta";
const TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
const FALLBACKS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

// Words from the film and ad world, so names like these come out right.
const VOCABULARY = ["Menab", "مناب", "CPS", "PPM", "voiceover", "cutdown", "storyboard", "treatment", "call sheet", "Ramadan", "رمضان", "iftar", "فطور", "Dalla", "دلة"];

export type Transcript = { text: string; provider: string; model: string; usage: { inputTokens: number; outputTokens: number; costUsd: number; seconds: number } };

export async function transcribe(audio: Buffer, mimeType: string, signal?: AbortSignal): Promise<Transcript> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in Vercel");
  const errors: string[] = [];
  try {
    return await viaTranscribe(audio, mimeType, key, signal);
  } catch (e) {
    if (signal?.aborted) throw e;
    errors.push(e instanceof Error ? e.message : String(e));
  }
  for (const model of FALLBACKS) {
    try {
      return await viaGenerate(model, audio, mimeType, key, signal);
    } catch (e) {
      if (signal?.aborted) throw e;
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(" | "));
}

const seconds = (t: number) => Math.round((Date.now() - t) / 100) / 10;
const timeout = (signal?: AbortSignal, ms = 45_000) => (signal ? AbortSignal.any([AbortSignal.timeout(ms), signal]) : AbortSignal.timeout(ms));

// Collects the text from an Interactions API answer, whatever its exact shape.
function textOf(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  if (typeof b.output_text === "string") return b.output_text;
  const parts: string[] = [];
  const walk = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if ((o.type === "text" || o.type === "output_text") && typeof o.text === "string") parts.push(o.text);
    for (const k of ["outputs", "output", "steps", "content"]) if (k in o) walk(o[k]);
  };
  walk(b);
  return parts.join("");
}

async function viaTranscribe(audio: Buffer, mimeType: string, key: string, signal?: AbortSignal): Promise<Transcript> {
  const started = Date.now();
  const res = await fetch(`${API}/interactions`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    cache: "no-store",
    signal: timeout(signal),
    body: JSON.stringify({
      model: TRANSCRIBE_MODEL,
      input: [{ type: "audio", data: audio.toString("base64"), mime_type: mimeType }],
      generation_config: { transcription_config: { mode: "smart", custom_vocabulary: VOCABULARY } },
    }),
  });
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok || !body || body.error) throw new Error(`Gemini 3.5 Transcribe: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  const text = textOf(body).trim();
  if (!text) throw new Error("Gemini 3.5 Transcribe: empty answer");
  return { text, provider: "google", model: TRANSCRIBE_MODEL, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, seconds: seconds(started) } };
}

async function viaGenerate(model: string, audio: Buffer, mimeType: string, key: string, signal?: AbortSignal): Promise<Transcript> {
  const started = Date.now();
  const res = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    cache: "no-store",
    signal: timeout(signal),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: audio.toString("base64") } }, { text: PROMPT }] }],
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  } | null;
  if (!res.ok || !body || body.error) throw new Error(`${model}: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  const text = (body.candidates?.[0]?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
  if (!text) throw new Error(`${model}: empty answer`);
  return {
    text,
    provider: "google",
    model,
    usage: { inputTokens: body.usageMetadata?.promptTokenCount ?? 0, outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0, costUsd: 0, seconds: seconds(started) },
  };
}
