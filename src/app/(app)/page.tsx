import { ProjectList } from "@/components/project-list";
import { getI18n } from "@/lib/i18n/server";

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
  return (
    <div className="max-w-[1100px] flex flex-col gap-5">
      <h1 className="h1 m-0">{t.home.title}</h1>
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
