import "server-only";
import { TRANSCRIBER } from "./catalog";
import { KIE_USD_PER_CREDIT } from "./kie";

// Voice notes: Gemini turns the recording into text, which lands in the reply box.
// First choice: Gemini 3.8 Flash through Kie.ai (paid, a fraction of a cent, reliable).
// It is tried twice; Google's free tier (GEMINI_API_KEY) is the last backup, since it is often
// too busy to answer.

const PROMPT =
  "Transcribe this voice note exactly as spoken. It is a video production brief, usually in Saudi Arabic, sometimes mixed with English. Keep the original language and words. Return only the transcript, no notes.";

export async function transcribe(audio: Buffer, mimeType: string) {
  const errors: string[] = [];
  if (process.env.KIE_API_KEY) {
    for (let i = 0; i < 2; i++) {
      try {
        return await transcribeWithKie(audio, mimeType);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      return await transcribeWithGoogle(audio, mimeType);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(" | ") || "No voice model is set up (KIE_API_KEY)");
}

async function transcribeWithGoogle(audio: Buffer, mimeType: string) {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
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
  // Thinking is turned off: writing down what was said needs no reasoning, and it roughly
  // halves the wait. If the gateway refuses the setting, ask again without it.
  const call = (fast: boolean) =>
    fetch(`https://api.kie.ai/gemini/v1/models/${TRANSCRIBER.model}:streamGenerateContent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
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
        ...(fast ? { generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } } } : {}),
      }),
    });
  let res = await call(true);
  let raw = await res.text();
  // Kie.ai can report a refused setting with HTTP 200 and a code in the body.
  if (res.status === 400 || res.status === 422 || /"code"\s*:\s*4(00|22)\b/.test(raw.slice(0, 300))) {
    res = await call(false);
    raw = await res.text();
  }
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
  const credits = [...chunks].reverse().find((c) => typeof (c as { credits_consumed?: number })?.credits_consumed === "number") as { credits_consumed?: number } | undefined;
  const costUsd = credits?.credits_consumed != null
    ? Math.round(credits.credits_consumed * KIE_USD_PER_CREDIT * 10000) / 10000
    : Math.round(((inputTokens + outputTokens) * TRANSCRIBER.usdPerMillion) / 1_000_000 * 10000) / 10000;
  return {
    text,
    provider: "kie.ai",
    model: TRANSCRIBER.model,
    usage: { inputTokens, outputTokens, costUsd, seconds: Math.round((Date.now() - started) / 100) / 10 },
  };
}

// The same, but the words arrive as Gemini writes them, so they appear in the reply box
// right away. Falls back to the normal call (with its own backups) if streaming fails before
// any words came.
export async function transcribeStreaming(audio: Buffer, mimeType: string, onText: (delta: string) => void, signal?: AbortSignal) {
  const key = process.env.KIE_API_KEY;
  const started = Date.now();
  let got = "";
  if (key) {
    try {
      const res = await fetch(`https://api.kie.ai/gemini/v1/models/${TRANSCRIBER.model}:streamGenerateContent`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        cache: "no-store",
        signal: signal ? AbortSignal.any([AbortSignal.timeout(60_000), signal]) : AbortSignal.timeout(60_000),
        body: JSON.stringify({
          stream: true,
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: audio.toString("base64") } }, { text: PROMPT }] }],
          generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
        }),
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
        let credits: number | undefined;
        let failed = "";
        const handle = (line: string) => {
          const data = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
          if (!data || data === "[DONE]") return;
          let c: { code?: number; msg?: string; credits_consumed?: number; usageMetadata?: typeof usage; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
          try {
            c = JSON.parse(data);
          } catch {
            return;
          }
          if (typeof c.code === "number" && c.code !== 200) failed = c.msg ?? `code ${c.code}`;
          if (c.usageMetadata) usage = c.usageMetadata;
          if (typeof c.credits_consumed === "number") credits = c.credits_consumed;
          const text = (c.candidates?.[0]?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
          if (text) {
            got += text;
            onText(text);
          }
        };
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handle);
        }
        handle(buffer);
        if (got.trim()) {
          const inputTokens = usage?.promptTokenCount ?? 0;
          const outputTokens = usage?.candidatesTokenCount ?? 0;
          const costUsd = credits != null
            ? Math.round(credits * KIE_USD_PER_CREDIT * 10000) / 10000
            : Math.round(((inputTokens + outputTokens) * TRANSCRIBER.usdPerMillion) / 1_000_000 * 10000) / 10000;
          return { text: got.trim(), provider: "kie.ai", model: TRANSCRIBER.model, usage: { inputTokens, outputTokens, costUsd, seconds: Math.round((Date.now() - started) / 100) / 10 } };
        }
        // Nothing came back (for example the gateway refused a setting): use the normal call below.
        void failed;
      }
    } catch (e) {
      if (signal?.aborted) throw e;
      if (got) throw e; // half a transcript: let the person try again rather than doubling words
    }
  }
  const r = await transcribe(audio, mimeType);
  onText(r.text);
  return r;
}
