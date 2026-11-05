import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { dictionaries, type Dictionary } from "./dictionaries";

// Languages beyond English and Arabic. Their interface text is translated from English by
// Gemini (Google's free tier) the first time someone picks the language, stored, and made
// again automatically whenever the English text changes. Arabic stays written by hand.
export const MACHINE_LOCALES: Record<string, { name: string; rtl?: boolean }> = {
  am: { name: "Amharic" },
  ur: { name: "Urdu", rtl: true },
  hi: { name: "Hindi" },
  id: { name: "Indonesian" },
  tr: { name: "Turkish" },
  fr: { name: "French" },
  es: { name: "Spanish" },
  de: { name: "German" },
  pt: { name: "Portuguese" },
  ru: { name: "Russian" },
  zh: { name: "Simplified Chinese" },
};

export const DICTIONARY_VERSION = createHash("sha1").update(JSON.stringify(dictionaries.en)).digest("hex").slice(0, 12);

const memory = new Map<string, Dictionary>();

// Fill any key the translation missed with the English text, so nothing is ever blank.
function mergeWithEnglish(en: unknown, tr: unknown): unknown {
  if (typeof en === "string") return typeof tr === "string" && tr.trim() ? tr : en;
  if (Array.isArray(en)) return en;
  if (en && typeof en === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(en)) out[k] = mergeWithEnglish(v, tr && typeof tr === "object" ? (tr as Record<string, unknown>)[k] : undefined);
    return out;
  }
  return en;
}

export async function storedTranslation(locale: string): Promise<Dictionary | null> {
  const key = `${locale}:${DICTIONARY_VERSION}`;
  if (memory.has(key)) return memory.get(key)!;
  try {
    const { data } = await createAdminClient()
      .from("translations")
      .select("dictionary")
      .eq("locale", locale)
      .eq("version", DICTIONARY_VERSION)
      .maybeSingle();
    if (!data) return null;
    const dict = mergeWithEnglish(dictionaries.en, data.dictionary) as Dictionary;
    memory.set(key, dict);
    return dict;
  } catch {
    return null;
  }
}

export async function ensureTranslation(locale: string): Promise<{ ok: boolean; error?: string }> {
  const lang = MACHINE_LOCALES[locale];
  if (!lang) return { ok: false, error: "Unknown language" };
  if (await storedTranslation(locale)) return { ok: true };
  const key = process.env.GEMINI_API_KEY ?? "";
  if (!key && !process.env.KIE_API_KEY) return { ok: false, error: "KIE_API_KEY is not set in Vercel" };

  // The dictionary is translated in small parts, a few at a time, so one long answer can't
  // time out or come back cut off. A part that fails is tried once more.
  const en = dictionaries.en as unknown as Record<string, unknown>;
  const parts: Record<string, unknown>[] = [];
  let part: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(en)) {
    part[k] = v;
    if (JSON.stringify(part).length > 6000) {
      parts.push(part);
      part = {};
    }
  }
  if (Object.keys(part).length) parts.push(part);

  try {
    const parsed: Record<string, unknown> = {};
    for (let i = 0; i < parts.length; i += 3) {
      const done = await Promise.all(parts.slice(i, i + 3).map((x) => translatePart(x, lang.name, key).catch(() => translatePart(x, lang.name, key))));
      for (const d of done) Object.assign(parsed, d);
    }
    const dict = mergeWithEnglish(dictionaries.en, parsed) as Dictionary;
    await createAdminClient()
      .from("translations")
      .upsert({ locale, version: DICTIONARY_VERSION, dictionary: dict });
    memory.set(`${locale}:${DICTIONARY_VERSION}`, dict);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Translation failed" };
  }
}

async function translatePart(part: Record<string, unknown>, language: string, key: string): Promise<Record<string, unknown>> {
  const prompt = `Translate the values of this JSON into ${language} for the interface of Menab, a video production web app used by producers.
Rules:
- Return the same JSON with the same keys and structure. Translate only string values.
- Keep every placeholder in curly braces exactly, e.g. {n}, {name}, {cost}.
- Keep these as they are: Menab, Menab AI, CPS, PPM, GAMR, GACA, Kie.ai, Gemini, Claude, model names, milestone codes like M2 or v2, file types, emails.
- Plain, friendly, short product wording. Buttons start with a verb. No em dashes.
- Values written in Arabic script (the language switch label) stay as they are.

JSON:
${JSON.stringify(part)}`;
  // Gemini through Kie.ai first (reliable); Google's free tier only as the backup.
  const errors: string[] = [];
  if (process.env.KIE_API_KEY) {
    try {
      return await viaKie(prompt, process.env.KIE_API_KEY);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (key) {
    try {
      return await viaGoogle(prompt, key);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error(errors.join(" | ") || "No translation model is set up");
}

const parseJson = (text: string) => JSON.parse(text.replace(/^\s*```(json)?|```\s*$/g, "").trim()) as Record<string, unknown>;

async function viaKie(prompt: string, key: string) {
  const res = await fetch("https://api.kie.ai/gemini/v1/models/gemini-3-8-flash:streamGenerateContent", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      stream: false,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000 },
    }),
  });
  const raw = await res.text();
  let chunks: unknown[];
  try {
    const j = JSON.parse(raw);
    chunks = Array.isArray(j) ? j : [j];
  } catch {
    chunks = raw.split("\n").filter((l) => l.startsWith("data:")).map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } }).filter(Boolean);
  }
  type Chunk = { code?: number; msg?: string; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const list = chunks as Chunk[];
  const err = list.find((c) => c && typeof c.code === "number" && c.code !== 200);
  if (!res.ok || err) throw new Error(`Kie.ai translation: ${err?.msg ?? `HTTP ${res.status}`}`);
  const text = list.flatMap((c) => c?.candidates?.[0]?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  return parseJson(text);
}

async function viaGoogle(prompt: string, key: string) {
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000 },
    }),
  });
  const json = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  } | null;
  if (!res.ok || !json || json.error) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  const text = (json.candidates?.[0]?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  return parseJson(text);
}

// Prepares languages nobody has picked yet, a couple at a time, in the background after a page
// is shown. Once ready, switching to them is instant.
let warming = false;
export async function warmTranslations(max = 2) {
  if (warming || (!process.env.KIE_API_KEY && !process.env.GEMINI_API_KEY)) return;
  warming = true;
  try {
    const { data } = await createAdminClient().from("translations").select("locale").eq("version", DICTIONARY_VERSION);
    const done = new Set((data ?? []).map((r) => r.locale as string));
    const missing = Object.keys(MACHINE_LOCALES).filter((l) => !done.has(l)).slice(0, max);
    for (const l of missing) await ensureTranslation(l);
  } catch {
    // Not urgent: the next page view tries again.
  } finally {
    warming = false;
  }
}
