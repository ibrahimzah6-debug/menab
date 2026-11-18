import { cookies, headers } from "next/headers";
import { dictionaries, type Locale } from "./dictionaries";
import { createAdminClient } from "@/lib/supabase/admin";
import { MACHINE_LOCALES, missingCount, translation } from "./translate";

export const LOCALE_COOKIE = "menab-locale";

// The language picked in the menu: English, Arabic, or one of the translated languages.
export async function getUiLocale(): Promise<string> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved && (saved === "en" || saved === "ar" || saved in MACHINE_LOCALES)) return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export async function getLocale(): Promise<Locale> {
  return (await getUiLocale()) === "ar" ? "ar" : "en";
}

// `locale` is "en" or "ar" for content that exists in those two (model notes, dates);
// `uiLocale` is the language actually shown, and `t` its interface text.
export async function getI18n() {
  const uiLocale = await getUiLocale();
  const locale: Locale = uiLocale === "ar" ? "ar" : "en";
  let t = dictionaries[locale];
  if (uiLocale !== "en" && uiLocale !== "ar") t = translation(uiLocale, missingCount(uiLocale) ? await olderTranslation(uiLocale) : undefined) ?? dictionaries.en;
  const rtl = uiLocale === "ar" || MACHINE_LOCALES[uiLocale]?.rtl;
  return { locale, uiLocale, t, dir: rtl ? "rtl" : "ltr" } as const;
}

// Languages whose stored file is not complete yet borrow the last translation saved in the
// database (made by AI before languages were stored with the app). Read once per language.
const older = new Map<string, unknown>();
async function olderTranslation(locale: string): Promise<unknown> {
  if (older.has(locale)) return older.get(locale);
  let dict: unknown = undefined;
  try {
    const { data } = await createAdminClient().from("translations").select("dictionary").eq("locale", locale).order("created_at", { ascending: false }).limit(1).maybeSingle();
    dict = data?.dictionary ?? undefined;
  } catch {
    // No database access (local build): English fills the gaps.
  }
  older.set(locale, dict);
  return dict;
}
