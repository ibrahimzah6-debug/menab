import Link from "next/link";
import { LangChoice } from "./lang-choice";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember } from "@/lib/workspace";

export default async function SettingsPage() {
  const { locale, t } = await getI18n();
  const member = await getCurrentMember();
  return (
    <div className="max-w-[880px] flex flex-col gap-6">
      <h1 className="h1 m-0 mb-6">{t.settings.title}</h1>
      <section className="bg-surface border border-line rounded-lg p-6 flex flex-col gap-3">
        <h2 className="h3 m-0">{t.settings.language}</h2>
        <p className="body text-ink-muted m-0">{t.settings.languageBody}</p>
        <LangChoice current={locale} english={t.settings.english} arabic={t.settings.arabic} label={t.settings.language} />
      </section>
      {member?.role === "admin" && (
        <section className="bg-surface border border-line rounded-lg p-6 flex flex-col gap-3">
          <h2 className="h3 m-0">{t.settings.providerTest}</h2>
          <p className="body text-ink-muted m-0">{t.settings.providerTestBody}</p>
          <div>
            <Link href="/provider-test" className="mn-btn mn-btn--secondary mn-btn--sm">{t.settings.open}</Link>
          </div>
        </section>
      )}
      {member && (
        <section className="bg-surface border border-line rounded-lg p-6 flex flex-col gap-2">
          <h2 className="h3 m-0">{t.settings.account}</h2>
          <p className="body m-0" dir="ltr" style={{ textAlign: "start" }}>{member.email}</p>
          <p className="small text-ink-muted m-0">{t.roles[member.role]} · {member.workspace.name}</p>
        </section>
      )}
    </div>
  );
}
