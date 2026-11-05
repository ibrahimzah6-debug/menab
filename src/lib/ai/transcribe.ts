import "server-only";
import { TRANSCRIBER } from "./catalog";

// Voice briefs: Gemini turns a voice note into text, then Claude reads the text.
// First choice: Google's Gemini API with Menab's own free-tier key (GEMINI_API_KEY in Vercel).
// Note: on the free tier Google may use the content to improve its models (Ibrahim accepted this).
// If no Gemini key is set, Gemini through Kie.ai is used instead.

const PROMPT =
  "Transcribe this voice note exactly as spoken. It is a video production brief, usually in Saudi Arabic, sometimes mixed with English. Keep the original language and words. Return only the transcript, no notes.";

export async function transcribe(audio: Buffer, mimeType: string) {
  if (process.env.GEMINI_API_KEY) return transcribeWithGoogle(audio, mimeType);
  return transcribeWithKie(audio, mimeType);
}

async function transcribeWithGoogle(audio: Buffer, mimeType: string) {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: audio.toString("base64") } }, { text: PROMPT }] }],
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  } | null;
  if (!res.ok || !body || body.error) throw new Error(`Gemini voice: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) throw new Error("The voice note came back empty. Try recording again.");
  return {
    text,
    provider: "google",
    model,
    usage: {
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      costUsd: 0, // free tier
      seconds: Math.round((Date.now() - started) / 100) / 10,
    },
  };
}

async function transcribeWithKie(audio: Buffer, mimeType: string) {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY is not set in Vercel");
  const started = Date.now();
  const res = await fetch(`https://api.kie.ai/gemini/v1/models/${TRANSCRIBER.model}:streamGenerateContent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      stream: false,
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: mimeType, data: audio.toString("base64") } },
            { text: PROMPT },
          ],
        },
      ],
    }),
  });
  const raw = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    // Some gateways answer as a stream even when asked not to: join the data lines.
    body = raw
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => {
        try {
          return JSON.parse(l.slice(5));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
  const chunks = (Array.isArray(body) ? body : [body]) as {
    code?: number;
    msg?: string;
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  }[];
  const err = chunks.find((c) => c && typeof c.code === "number" && c.code !== 200);
  if (!res.ok || err) throw new Error(`Kie.ai voice: ${err?.msg ?? `HTTP ${res.status}`}`);

  const text = chunks
    .flatMap((c) => c?.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
  if (!text) throw new Error("The voice note came back empty. Try recording again.");

  const usage = [...chunks].reverse().find((c) => c?.usageMetadata)?.usageMetadata;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  const costUsd = Math.round(((inputTokens + outputTokens) * TRANSCRIBER.usdPerMillion) / 1_000_000 * 10000) / 10000;
  return {
    text,
    provider: "kie.ai",
    model: TRANSCRIBER.model,
    usage: { inputTokens, outputTokens, costUsd, seconds: Math.round((Date.now() - started) / 100) / 10 },
  };
}
