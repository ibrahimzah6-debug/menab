import { Kpi, ModelTable, usd } from "@/components/usage-tables";
import { getI18n } from "@/lib/i18n/server";
import { byModel, workspaceUsage } from "@/lib/usage";
import { getCurrentMember } from "@/lib/workspace";

// Credits: what this workspace spent on AI, by project and by model. Top-up comes later.
export default async function CreditsPage() {
  const { t } = await getI18n();
  const o = t.owner;
  const c = t.credits;
  const me = await getCurrentMember();
  if (!me) return null;
  const { jobs, projects } = await workspaceUsage(me.workspace.id, 30);
  const cost = jobs.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
  const perProject = projects
    .map((p) => ({ name: p.name, cost: jobs.filter((j) => j.project_id === p.id).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0), calls: jobs.filter((j) => j.project_id === p.id).length }))
    .filter((p) => p.calls > 0)
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="max-w-[1100px] flex flex-col gap-6">
      <div>
        <h1 className="h1 m-0">{t.nav.credits}</h1>
        <p className="body text-ink-muted m-0 mt-1">{c.intro}</p>
      </div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Kpi label={o.cost} value={usd(cost)} note={o.last30} />
        <Kpi label={o.calls} value={String(jobs.length)} note={o.last30} />
        <Kpi label={c.balance} value="–" note={c.balanceLater} />
      </div>
      <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
        <h2 className="h3 m-0">{c.byProject}</h2>
        {perProject.length === 0 ? (
          <p className="small text-ink-muted m-0">{o.table.empty}</p>
        ) : (
          <table className="w-full border-collapse small">
            <thead>
              <tr>{[c.project, o.calls, o.cost].map((x) => <th key={x} className="mn-label text-start py-2 pe-4">{x}</th>)}</tr>
            </thead>
            <tbody>
              {perProject.map((p) => (
                <tr key={p.name} className="border-t border-line">
                  <td className="py-2 pe-4">{p.name}</td>
                  <td className="py-2 pe-4 data">{p.calls}</td>
                  <td className="py-2 pe-4 data">{usd(p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
        <h2 className="h3 m-0">{o.byModel}</h2>
        <ModelTable rows={byModel(jobs)} h={o.table} />
      </section>
    </div>
  );
}
