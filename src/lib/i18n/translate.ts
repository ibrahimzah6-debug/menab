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
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "GEMINI_API_KEY is not set in Vercel" };

  const prompt = `Translate the values of this JSON into ${lang.name} for the interface of Menab, a video production web app used by producers.
Rules:
- Return the same JSON with the same keys and structure. Translate only string values.
- Keep every placeholder in curly braces exactly, e.g. {n}, {name}, {cost}.
- Keep these as they are: Menab, Menab AI, CPS, PPM, GAMR, GACA, Kie.ai, Gemini, Claude, model names, milestone codes like M2 or v2, file types, emails.
- Plain, friendly, short product wording. Buttons start with a verb. No em dashes.
- Values written in Arabic script (the language switch label) stay as they are.

JSON:
${JSON.stringify(dictionaries.en)}`;

  try {
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 60000 },
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    } | null;
    if (!res.ok || !json || json.error) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    const text = (json.candidates?.[0]?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
    const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
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
