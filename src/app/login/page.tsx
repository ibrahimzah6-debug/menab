import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  const { t } = await getI18n();
  const { error } = await searchParams;
  return (
    <AuthFrame>
      <h1 className="h2 m-0 mb-2">{t.login.title}</h1>
      <p className="small text-ink-muted m-0 mb-6">{error === "link" ? t.auth.linkExpired : t.login.inviteOnly}</p>
      <LoginForm copy={t.login} />
    </AuthFrame>
  );
}
