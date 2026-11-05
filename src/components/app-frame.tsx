import { after } from "next/server";
import { cookies } from "next/headers";
import { warmTranslations } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember, getMemberships, getUserEmail } from "@/lib/workspace";
import { isPlatformAdmin } from "@/lib/usage";
import { Logo } from "./logo";
import { Sidebar } from "./sidebar";

// The same frame on every screen: a side menu that opens and closes, like Claude. It starts
// closed; on a phone it slides over the page from a menu button.
export async function AppFrame({ children, defaultOpen = false }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const { locale, t } = await getI18n();
  const email = await getUserEmail();
  if (!email) redirect("/login");
  const member = await getCurrentMember();
  const all = await getMemberships();
  const saved = (await cookies()).get("menab-menu")?.value;
  const open = saved ? saved === "open" : defaultOpen;
  // The profile photo, through a short-lived link.
  let photo: string | undefined;
  if (member?.avatarPath) {
    try {
      const { data } = await createAdminClient().storage.from("media").createSignedUrl(member.avatarPath, 3600);
      photo = data?.signedUrl;
    } catch {
      photo = undefined;
    }
  }
  // After the page is sent, prepare a couple of languages nobody has picked yet.
  after(() => warmTranslations(2));

  return (
    <div className="min-h-screen flex flex-col md:flex-row" data-menu={open ? "open" : "closed"}>
      <Sidebar
        initialOpen={open}
        logo={<Logo height={20} />}
        mark={<Logo height={18} mark />}
        locale={locale}
        labels={{ ...t.nav, ...t.frame, signOut: t.account.signOut, langSwitch: t.langSwitch, langSwitchLabel: t.langSwitchLabel, viewerNote: t.projects.viewerNote, owner: t.owner.nav, account: t.settings.account, language: t.settings.language, soon: t.frame.soon }}
        workspaces={all.map((m) => m.workspace)}
        currentWorkspace={member?.workspace ?? null}
        canCreate={Boolean(member && ["admin", "producer"].includes(member.role))}
        person={member?.fullName || email}
        email={email}
        photo={photo}
        role={member ? t.roles[member.role] : ""}
        isOwner={await isPlatformAdmin()}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        {member ? (
          children
        ) : (
          <div className="max-w-[440px] mx-auto mt-24 text-center px-4">
            <h1 className="h2 m-0 mb-2">{t.noWorkspace.title}</h1>
            <p className="body text-ink-muted m-0">{t.noWorkspace.body}</p>
          </div>
        )}
      </div>
    </div>
  );
}
