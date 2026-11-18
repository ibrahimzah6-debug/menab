"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "./server";
import { MACHINE_LOCALES } from "./translate";

// Switches the interface language. Every language is stored with the app, so it is instant.
export async function setLocale(locale: string): Promise<{ error?: string }> {
  const value = locale === "ar" || locale === "en" || locale in MACHINE_LOCALES ? locale : "en";
  (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return {};
}
