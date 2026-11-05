import { notFound } from "next/navigation";
import { Kpi, ModelTable, usd } from "@/components/usage-tables";
import { getI18n } from "@/lib/i18n/server";
import { byModel, isPlatformAdmin, ownerOverview } from "@/lib/usage";

// The owner dashboard: every workspace, AI use and cost, failures, backups and notices.
export default async function OwnerPage() {
  if (!(await isPlatformAdmin())) notFound();
  const { locale, t } = await getI18n();
  const o = t.owner;
  const { jobs, workspaces, members, projects, notices } = await ownerOverview(30);

  const cost = jobs.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);
  const failed = jobs.filter((j) => j.status === "failed").length;
  const backups = jobs.filter((j) => j.fallback_from).length;
  const date = (x: string) =>
    new Date(x).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });
  const wsName = (id: string | null) => workspaces.find((w) => w.id === id)?.name ?? "Menab";

  return (
    <div className="max-w-[1180px] flex flex-col gap-6">
      <div>
        <h1 className="h1 m-0">{o.title}</h1>
        <p className="body text-ink-muted m-0 mt-1">{o.intro}</p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Kpi label={o.calls} value={String(jobs.length)} note={o.last30} />
        <Kpi label={o.cost} value={usd(cost)} note={o.last30} />
        <Kpi label={o.failed} value={String(failed)} note={o.noCharge} />
        <Kpi label={o.backups} value={String(backups)} note={o.backupNote} />
      </div>

      <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
        <h2 className="h3 m-0">{o.byModel}</h2>
        <ModelTable rows={byModel(jobs)} h={o.table} />
      </section>

      <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
        <h2 className="h3 m-0">{o.notices}</h2>
        {notices.length === 0 ? (
          <p className="small text-ink-muted m-0">{o.noNotices}</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col">
            {notices.map((n) => (
              <li key={n.id} className="border-t border-line first:border-t-0 py-2.5 grid grid-cols-[150px_1fr] gap-3">
                <span className="small text-ink-faint">{date(n.created_at)}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="small font-medium">
                    <span className="mn-chip mn-chip--waiting me-2">{o.kinds[n.kind as keyof typeof o.kinds] ?? n.kind}</span>
                    {n.title}
                  </span>
                  <span className="text-[12px] text-ink-faint">{wsName(n.workspace_id)}{n.body ? ` · ${n.body.slice(0, 160)}` : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-surface border border-line rounded-lg p-5 flex flex-col gap-3">
        <h2 className="h3 m-0">{o.workspaces}</h2>
        <table className="w-full border-collapse small">
          <thead>
            <tr>{[o.workspace, o.people, o.projects, o.cost].map((x) => <th key={x} className="mn-label text-start py-2 pe-4">{x}</th>)}</tr>
          </thead>
          <tbody>
            {workspaces.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="py-2 pe-4">{w.name}</td>
                <td className="py-2 pe-4 data">{members.filter((m) => m.workspace_id === w.id).length}</td>
                <td className="py-2 pe-4 data">{projects.filter((p) => p.workspace_id === w.id).length}</td>
                <td className="py-2 pe-4 data">{usd(jobs.filter((j) => j.workspace_id === w.id).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
