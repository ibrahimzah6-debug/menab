import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember, getMemberships, getUserEmail } from "@/lib/workspace";
import { Logo } from "./logo";
import { Sidebar } from "./sidebar";

// The same frame on every screen: a side menu that opens and closes, like Claude.
export async function AppFrame({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const { locale, t } = await getI18n();
  const email = await getUserEmail();
  if (!email) redirect("/login");
  const member = await getCurrentMember();
  const all = await getMemberships();
  const saved = (await cookies()).get("menab-sidebar")?.value;
  const open = saved ? saved === "open" : defaultOpen;

  return (
    <div className="min-h-screen flex">
      <Sidebar
        initialOpen={open}
        logo={<Logo height={20} />}
        mark={<Logo height={18} mark />}
        locale={locale}
        labels={{ ...t.nav, ...t.frame, signOut: t.account.signOut, langSwitch: t.langSwitch, langSwitchLabel: t.langSwitchLabel, viewerNote: t.projects.viewerNote }}
        workspaces={all.map((m) => m.workspace)}
        currentWorkspace={member?.workspace ?? null}
        canCreate={Boolean(member && ["admin", "producer"].includes(member.role))}
        person={member?.fullName || email}
        role={member ? t.roles[member.role] : ""}
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
