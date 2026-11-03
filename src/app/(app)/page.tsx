import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-lg p-6 flex flex-col gap-2">
      <h2 className="h3 m-0">{title}</h2>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const { t } = await getI18n();
  return (
    <div className="max-w-[880px] flex flex-col gap-6">
      <h1 className="h1 m-0 mb-6">{t.home.title}</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title={t.home.inProgress}><p className="body text-ink-muted m-0">{t.home.noProjects}</p></Panel>
        <Panel title={t.home.waiting}><p className="body text-ink-muted m-0">{t.home.nothingWaiting}</p></Panel>
        <Panel title={t.home.activity}><p className="body text-ink-muted m-0">{t.home.noActivity}</p></Panel>
        <Panel title={t.home.balance}><p className="body text-ink-muted m-0">{t.home.balanceLater}</p></Panel>
      </div>
      <Panel title={t.home.previewTitle}>
        <p className="body text-ink-muted m-0 mb-2">{t.home.previewBody}</p>
        <div>
          <Link href="/preview/stage" className="mn-btn mn-btn--secondary mn-btn--sm">{t.home.previewOpen}</Link>
        </div>
      </Panel>
    </div>
  );
}
