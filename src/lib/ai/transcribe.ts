import "server-only";
import { TRANSCRIBER } from "./catalog";

// Voice briefs: Gemini through Kie.ai turns a voice note into text. Claude then reads the text.
// Docs: https://docs.kie.ai/market/gemini/gemini-3-8-flash (native Gemini format, inline_data parts).

export async function transcribe(audio: Buffer, mimeType: string) {
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
            {
              text: "Transcribe this voice note exactly as spoken. It is a video production brief, usually in Saudi Arabic, sometimes mixed with English. Keep the original language and words. Return only the transcript, no notes.",
            },
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
  return { text, usage: { inputTokens, outputTokens, costUsd, seconds: Math.round((Date.now() - started) / 100) / 10 } };
}
