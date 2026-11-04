import { AuthFrame } from "@/components/auth-frame";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash = "", type = "" } = await searchParams;
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const currentEmail = (data?.claims?.email as string | undefined) ?? null;

  return (
    <AuthFrame>
      <h1 className="h2 m-0 mb-2">{t.auth.acceptTitle}</h1>
      <p className="small text-ink-muted m-0 mb-6">{t.auth.acceptBody}</p>
      {currentEmail && (
        <p className="small m-0 mb-6 p-3 rounded-md bg-ground-deep border border-line">
          {fill(t.auth.otherAccount, { email: currentEmail })}
        </p>
      )}
      <form action={acceptInvite} className="flex flex-col">
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <button className="mn-btn mn-btn--primary justify-center">{t.auth.acceptSubmit}</button>
      </form>
    </AuthFrame>
  );
}
