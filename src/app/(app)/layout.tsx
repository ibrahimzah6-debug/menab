import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconPlus } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { SideNav } from "@/components/side-nav";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember, getUserEmail } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  const member = await getCurrentMember();
  const email = await getUserEmail();
  if (!email) redirect("/login");

  const header = (
    <header className="flex items-center gap-4 px-6 py-3.5 bg-surface border-b border-line">
      <Link href="/" aria-label="Menab">
        <Image src="/brand/menab-logo-ink.png" alt="Menab" width={86} height={22} priority style={{ height: 22, width: "auto" }} />
      </Link>
      {member && (
        <>
          <span className="text-line-strong" aria-hidden="true">/</span>
          <span className="text-[15px] font-medium">{member.workspace.name}</span>
        </>
      )}
      <span className="grow" />
      <span className="small text-ink-muted hidden sm:inline" dir="ltr">{email}</span>
      <LangSwitch to={locale === "ar" ? "en" : "ar"} label={t.langSwitch} ariaLabel={t.langSwitchLabel} />
      <form action="/auth/signout" method="post">
        <button className="mn-btn mn-btn--ghost mn-btn--sm">{t.account.signOut}</button>
      </form>
    </header>
  );

  if (!member) {
    return (
      <div className="min-h-screen flex flex-col">
        {header}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-[440px] text-center">
            <h1 className="h2 m-0 mb-2">{t.noWorkspace.title}</h1>
            <p className="body text-ink-muted m-0">{t.noWorkspace.body}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="md:w-[248px] shrink-0 p-4 md:border-e border-b md:border-b-0 border-line bg-ground-deep flex flex-col gap-4">
          <button
            type="button"
            className="mn-btn mn-btn--primary justify-center w-full"
            disabled
            title={t.nav.newProjectLater}
            aria-describedby="new-project-later"
          >
            <IconPlus size={16} />
            {t.nav.newProject}
          </button>
          <span id="new-project-later" className="sr-only">{t.nav.newProjectLater}</span>
          <SideNav labels={t.nav} menuLabel={t.nav.mainMenu} />
        </aside>
        <main className="flex-1 min-w-0 p-6 md:p-12">{children}</main>
      </div>
    </div>
  );
}
