import { Logo } from "@/components/logo";
import { ProjectList } from "@/components/project-list";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentMember, getUserEmail } from "@/lib/workspace";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-2">
      <h2 className="h3 m-0">{title}</h2>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const { t } = await getI18n();
  const me = await getCurrentMember();
  const email = await getUserEmail();
  const name = (me?.fullName || email || "").split(/[ @]/)[0];
  // Riyadh time decides the greeting.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Riyadh" }).format(new Date()));
  const greeting = fill(hour >= 4 && hour < 12 ? t.home.morning : t.home.evening, { name });

  return (
    <div className="max-w-[1100px] flex flex-col gap-8">
      <div className="flex items-center gap-4 pt-2">
        <span className="w-12 h-12 rounded-lg border border-line bg-surface grid place-items-center shrink-0">
          <Logo height={18} mark />
        </span>
        <div>
          <h1 className="h1 m-0" dir="auto">{greeting}</h1>
          <p className="body text-ink-muted m-0 mt-1">{t.home.lead}</p>
        </div>
      </div>
      <Panel title={t.home.inProgress}>
        <ProjectList limit={6} />
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title={t.home.waiting}><p className="small text-ink-muted m-0">{t.home.nothingWaiting}</p></Panel>
        <Panel title={t.home.activity}><p className="small text-ink-muted m-0">{t.home.noActivity}</p></Panel>
        <Panel title={t.home.balance}><p className="small text-ink-muted m-0">{t.home.balanceLater}</p></Panel>
      </div>
    </div>
  );
}
