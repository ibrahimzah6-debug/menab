import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { Welcome } from "./welcome";

// The public website. A visitor sees it at "/" (the middleware rewrites); a signed-in person
// goes to Home instead.

export const metadata: Metadata = {
  title: "Menab",
  description: "From brief to delivery, made with AI, shot for real, or both.",
};

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");
  const { t, locale } = await getI18n();
  return <Welcome c={t.site} locale={locale === "ar" ? "ar" : "en"} />;
}
