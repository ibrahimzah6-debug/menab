import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const member = await getCurrentMember();
  const { t } = await getI18n();
  return (
    <AuthFrame>
      <h1 className="h2 m-0 mb-2">{t.setPassword.title}</h1>
      <p className="small text-ink-muted m-0 mb-6">
        {fill(t.setPassword.intro, { workspace: member?.workspace.name ?? "Menab" })}
      </p>
      <PasswordForm copy={t.setPassword} />
    </AuthFrame>
  );
}
