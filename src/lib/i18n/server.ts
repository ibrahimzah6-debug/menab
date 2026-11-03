import { cookies, headers } from "next/headers";
import { dictionaries, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "menab-locale";

export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved === "ar" || saved === "en") return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("ar") ? "ar" : "en";
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale], dir: locale === "ar" ? "rtl" : "ltr" } as const;
}
