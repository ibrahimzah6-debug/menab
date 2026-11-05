import Link from "next/link";
import { Logo } from "@/components/logo";
import { ProjectList } from "@/components/project-list";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { data: notices } = me
    ? await supabase.from("notifications").select("id, title, created_at").eq("workspace_id", me.workspace.id).order("created_at", { ascending: false }).limit(5)
    : { data: [] };
  // What waits for this person: stages ready to approve and choices only a person can make.
  const { data: open } = me
    ? await supabase.from("projects").select("id, name, path, current_stage, outputs(number, status)").eq("workspace_id", me.workspace.id).in("current_stage", [1, 2]).order("updated_at", { ascending: false }).limit(30)
    : { data: [] };
  const ready = (outs: { number: number; status: string }[], n: number) => ["ready", "edited", "approved"].includes(outs.find((o) => o.number === n)?.status ?? "");
  const todo = (open ?? []).flatMap((pr) => {
    const outs = (pr.outputs ?? []) as { number: number; status: string }[];
    if (pr.current_stage === 1 && [3, 4, 5, 6].every((n) => ready(outs, n))) return [{ id: pr.id, name: pr.name, what: pr.path ? t.home.todo.approveBrief : t.home.todo.choosePath, href: `/p/${pr.id}?o=3` }];
    if (pr.current_stage === 2 && ready(outs, 12)) return [{ id: pr.id, name: pr.name, what: t.home.todo.approveCreative, href: `/p/${pr.id}?o=12` }];
    if (pr.current_stage === 2 && ready(outs, 7) && !ready(outs, 8)) return [{ id: pr.id, name: pr.name, what: t.home.todo.pickDirection, href: `/p/${pr.id}?o=8` }];
    return [];
  });
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
        <Panel title={t.home.waiting}>
          {todo.length ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {todo.slice(0, 6).map((x) => (
                <li key={x.id}>
                  <Link href={x.href} className="flex flex-col rounded-md -mx-2 px-2 py-1.5 hover:bg-tint-2">
                    <span className="small font-medium" dir="auto">{x.name}</span>
                    <span className="text-[12px] text-ink-muted">{x.what}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small text-ink-muted m-0">{t.home.nothingWaiting}</p>
          )}
        </Panel>
        <Panel title={t.home.activity}>
          {notices && notices.length ? (
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {notices.map((n) => <li key={n.id} className="small text-ink-muted" dir="auto">{n.title}</li>)}
            </ul>
          ) : (
            <p className="small text-ink-muted m-0">{t.home.noActivity}</p>
          )}
        </Panel>
        <Panel title={t.home.balance}><p className="small text-ink-muted m-0">{t.home.balanceLater}</p></Panel>
      </div>
    </div>
  );
}
