import { dictionaries, type Dictionary } from "./dictionaries";
import am from "./locales/am.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import hi from "./locales/hi.json";
import id from "./locales/id.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import tr from "./locales/tr.json";
import ur from "./locales/ur.json";
import zh from "./locales/zh.json";

// Languages beyond English and Arabic. Their interface text is translated ahead of time and
// stored with the app (src/lib/i18n/locales), so switching is instant and needs no AI call.
// Arabic stays written by hand in dictionaries.ts. A text added to English later and not yet
// translated shows in English until the files are updated (npm run i18n:check lists them).
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

const FILES: Record<string, unknown> = { am, de, es, fr, hi, id, pt, ru, tr, ur, zh };

// Fill any text the translation does not have with the English text, so nothing is blank.
function mergeWithEnglish(en: unknown, tr: unknown): unknown {
  if (typeof en === "string") return typeof tr === "string" && tr.trim() ? tr : en;
  if (Array.isArray(en)) return en.map((v, i) => mergeWithEnglish(v, Array.isArray(tr) ? tr[i] : undefined));
  if (en && typeof en === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(en)) out[k] = mergeWithEnglish(v, tr && typeof tr === "object" ? (tr as Record<string, unknown>)[k] : undefined);
    return out;
  }
  return en;
}

// Fills the gaps of one translation with another (used for the older saved translations).
function fillFrom(base: unknown, extra: unknown): unknown {
  if (typeof base === "string" || base == null) return typeof base === "string" && base.trim() ? base : extra;
  if (Array.isArray(base)) return base.map((v, i) => fillFrom(v, Array.isArray(extra) ? extra[i] : undefined));
  if (typeof base === "object") {
    const out: Record<string, unknown> = { ...(extra && typeof extra === "object" ? (extra as Record<string, unknown>) : {}) };
    for (const [k, v] of Object.entries(base)) out[k] = fillFrom(v, extra && typeof extra === "object" ? (extra as Record<string, unknown>)[k] : undefined);
    return out;
  }
  return base;
}

const memory = new Map<string, Dictionary>();

// The stored file first; texts it lacks come from `older` (the last translation saved in the
// database before languages were stored with the app), then English.
export function translation(locale: string, older?: unknown): Dictionary | null {
  if (!(locale in FILES)) return null;
  const key = `${locale}:${older ? 1 : 0}`;
  if (!memory.has(key)) memory.set(key, mergeWithEnglish(dictionaries.en, older ? fillFrom(FILES[locale], older) : FILES[locale]) as Dictionary);
  return memory.get(key)!;
}

// How many English texts a language file still lacks.
export function missingCount(locale: string): number {
  let n = 0;
  const walk = (en: unknown, tr: unknown) => {
    if (typeof en === "string") { if (typeof tr !== "string" || !tr.trim()) n++; return; }
    if (Array.isArray(en)) { en.forEach((v, i) => walk(v, Array.isArray(tr) ? tr[i] : undefined)); return; }
    if (en && typeof en === "object") for (const [k, v] of Object.entries(en)) walk(v, tr && typeof tr === "object" ? (tr as Record<string, unknown>)[k] : undefined);
  };
  walk(dictionaries.en, FILES[locale]);
  return n;
}
