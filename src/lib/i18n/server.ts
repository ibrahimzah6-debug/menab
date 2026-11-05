import { cookies, headers } from "next/headers";
import { dictionaries, type Locale } from "./dictionaries";
import { MACHINE_LOCALES, storedTranslation } from "./translate";

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
  if (uiLocale !== "en" && uiLocale !== "ar") t = (await storedTranslation(uiLocale)) ?? dictionaries.en;
  const rtl = uiLocale === "ar" || MACHINE_LOCALES[uiLocale]?.rtl;
  return { locale, uiLocale, t, dir: rtl ? "rtl" : "ltr" } as const;
}
