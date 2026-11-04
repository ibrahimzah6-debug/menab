import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconPlus } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { SideNav } from "@/components/side-nav";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember, getUserEmail } from "@/lib/workspace";
import { createProject } from "@/app/p/[id]/actions";

// Side menu like Claude: logo and workspace on top, the main action, the areas,
// and the account, language and log out at the bottom.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  const member = await getCurrentMember();
  const email = await getUserEmail();
  if (!email) redirect("/login");

  const canCreate = member && ["admin", "producer"].includes(member.role);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-[232px] shrink-0 md:h-screen md:sticky md:top-0 bg-ground-deep border-b md:border-b-0 md:border-e border-line flex flex-col gap-4 p-3">
        <div className="flex items-center gap-2 px-2 pt-1">
          <Link href="/" aria-label="Menab">
            <Image src="/brand/menab-logo-light.png" alt="Menab" width={111} height={20} priority style={{ height: 20, width: "auto" }} />
          </Link>
        </div>
        {member && (
          <div className="px-2">
            <span className="mn-label block truncate">{member.workspace.name}</span>
          </div>
        )}
        {member && (
          canCreate ? (
            <form action={createProject}>
              <button className="mn-btn mn-btn--primary justify-center w-full">
                <IconPlus size={16} />
                {t.nav.newProject}
              </button>
            </form>
          ) : (
            <p className="small text-ink-faint m-0 px-2">{t.projects.viewerNote}</p>
          )
        )}
        {member && <SideNav labels={t.nav} menuLabel={t.nav.mainMenu} />}
        <span className="grow hidden md:block" />
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <div className="px-2 flex flex-col">
            <span className="small truncate" dir="ltr" style={{ textAlign: "start" }}>{member?.fullName || email}</span>
            {member && <span className="small text-ink-faint">{t.roles[member.role]}</span>}
          </div>
          <div className="flex items-center gap-1">
            <LangSwitch to={locale === "ar" ? "en" : "ar"} label={t.langSwitch} ariaLabel={t.langSwitchLabel} />
            <form action="/auth/signout" method="post">
              <button className="mn-btn mn-btn--ghost mn-btn--sm">{t.account.signOut}</button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-5 md:p-8">
        {member ? (
          children
        ) : (
          <div className="max-w-[440px] mx-auto mt-24 text-center">
            <h1 className="h2 m-0 mb-2">{t.noWorkspace.title}</h1>
            <p className="body text-ink-muted m-0">{t.noWorkspace.body}</p>
          </div>
        )}
      </main>
    </div>
  );
}
