"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "./server";
import { ensureTranslation, MACHINE_LOCALES } from "./translate";

// Switches the interface language. A translated language is prepared first (about a minute
// the very first time anyone picks it), so the switch never shows a half-translated screen.
export async function setLocale(locale: string): Promise<{ error?: string }> {
  const value = locale === "ar" || locale === "en" || locale in MACHINE_LOCALES ? locale : "en";
  if (value !== "en" && value !== "ar") {
    const res = await ensureTranslation(value);
    if (!res.ok) return { error: res.error };
  }
  (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return {};
}
