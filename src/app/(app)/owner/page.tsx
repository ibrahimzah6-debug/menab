import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Kpi, ModelTable, usd } from "@/components/usage-tables";
import { textModel, TEXT_MODELS } from "@/lib/ai/catalog";
import { modelHealth } from "@/lib/ai/health";
import { analyseIfStale } from "@/lib/dev";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { DICTIONARY_VERSION, MACHINE_LOCALES } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { byModel, isPlatformAdmin, ownerOverview } from "@/lib/usage";
import { CopyForClaude, ItemActions, PrepareLanguages, RuleActions, RuleForm, RunAnalysis } from "./owner-controls";

// The analysis and language preparation run from this page and can take a few minutes.
export const maxDuration = 300;

const SECTIONS = ["development", "overview", "models", "workspaces", "notices", "feedback", "rules", "tools"] as const;
type Section = (typeof SECTIONS)[number];
const STATUSES = ["open", "accepted", "done", "dismissed"] as const;

// The owner dashboard, laid out like Settings. Development comes first: Menab improving
// itself from how people use it.
export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ s?: string; status?: string }> }) {
  if (!(await isPlatformAdmin())) notFound();
  const { locale, t } = await getI18n();
  const o = t.owner;
  const sp = await searchParams;
  const section: Section = SECTIONS.includes(sp.s as Section) ? (sp.s as Section) : "development";
  const admin = createAdminClient();
  const card = "bg-surface border border-line rounded-lg p-5 flex flex-col gap-4";
  const date = (x: string) =>
    new Date(x).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });

  // A report older than a day is refreshed in the background after this page is shown.
  if (section === "development") after(() => analyseIfStale(locale));

  const needsOverview = ["overview", "models", "workspaces", "notices"].includes(section);
  const overview = needsOverview ? await ownerOverview(30) : null;
  const jobs = overview?.jobs ?? [];
  const wsName = (id: string | null) => overview?.workspaces.find((w) => w.id === id)?.name ?? "Menab";

  return (
    <div className="max-w-[1180px] flex flex-col gap-6">
      <div>
        <h1 className="h1 m-0">{o.title}</h1>
        <p className="body text-ink-muted m-0 mt-1">{o.intro}</p>
      </div>
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <nav aria-label={o.title} className="w-full md:w-[220px] shrink-0 flex md:flex-col gap-0.5 overflow-x-auto">
          {SECTIONS.map((x) => (
            <Link
              key={x}
              href={`/owner?s=${x}`}
              aria-current={x === section ? "page" : undefined}
              className={`h-9 px-3 rounded-md flex items-center text-[14px] whitespace-nowrap ${x === section ? "bg-tint-3 text-ink font-medium" : "text-ink-muted hover:bg-tint-2 hover:text-ink"}`}
            >
              {o.sections[x]}
            </Link>
          ))}
        </nav>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <h2 className="h2 m-0">{o.sections[section]}</h2>
          {section === "development" && <Development o={o} admin={admin} date={date} status={sp.status} card={card} />}

          {section === "overview" && overview && (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Kpi label={o.calls} value={String(jobs.length)} note={o.last30} />
              <Kpi label={o.cost} value={usd(jobs.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0))} note={o.last30} />
              <Kpi label={o.failed} value={String(jobs.filter((j) => j.status === "failed").length)} note={o.noCharge} />
              <Kpi label={o.backups} value={String(jobs.filter((j) => j.fallback_from).length)} note={o.backupNote} />
            </div>
          )}

          {section === "models" && <Models o={o} jobs={jobs} card={card} />}

          {section === "workspaces" && overview && (
            <section className={card}>
              <table className="w-full border-collapse small">
                <thead>
                  <tr>{[o.workspace, o.people, o.projects, o.cost].map((x) => <th key={x} className="mn-label text-start py-2 pe-4">{x}</th>)}</tr>
                </thead>
                <tbody>
                  {overview.workspaces.map((w) => (
                    <tr key={w.id} className="border-t border-line">
                      <td className="py-2 pe-4">{w.name}</td>
                      <td className="py-2 pe-4 data">{overview.members.filter((m) => m.workspace_id === w.id).length}</td>
                      <td className="py-2 pe-4 data">{overview.projects.filter((p) => p.workspace_id === w.id).length}</td>
                      <td className="py-2 pe-4 data">{usd(jobs.filter((j) => j.workspace_id === w.id).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {section === "notices" && overview && (
            <section className={card}>
              {overview.notices.length === 0 ? (
                <p className="small text-ink-muted m-0">{o.noNotices}</p>
              ) : (
                <ul className="m-0 p-0 list-none flex flex-col">
                  {overview.notices.map((n) => (
                    <li key={n.id} className="border-t border-line first:border-t-0 py-2.5 grid grid-cols-[130px_1fr] gap-3">
                      <span className="small text-ink-faint">{date(n.created_at)}</span>
                      <span className="flex flex-col gap-0.5">
                        <span className="small font-medium">
                          <span className="mn-chip mn-chip--waiting me-2">{o.kinds[n.kind as keyof typeof o.kinds] ?? n.kind}</span>
                          {n.title}
                        </span>
                        <span className="text-[12px] text-ink-faint">{wsName(n.workspace_id)}{n.body ? ` · ${n.body.slice(0, 200)}` : ""}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {section === "feedback" && <Feedback o={o} admin={admin} date={date} card={card} />}
          {section === "rules" && <Rules o={o} admin={admin} card={card} />}
          {section === "tools" && <Tools o={o} admin={admin} card={card} />}
        </div>
      </div>
    </div>
  );
}

type O = Awaited<ReturnType<typeof getI18n>>["t"]["owner"];
type Admin = ReturnType<typeof createAdminClient>;

async function Development({ o, admin, date, status, card }: { o: O; admin: Admin; date: (x: string) => string; status?: string; card: string }) {
  const shown = STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as (typeof STATUSES)[number]) : "open";
  const [{ data: report }, { data: items }, { data: accepted }] = await Promise.all([
    admin.from("dev_reports").select("summary, model, created_at, stats").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("dev_items").select("id, title, detail, evidence, kind, priority, status, created_at").eq("status", shown).order("created_at", { ascending: false }).limit(60),
    admin.from("dev_items").select("title, detail, evidence, kind").eq("status", "accepted").neq("kind", "prompt_rule").limit(40),
  ]);
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const list = [...(items ?? [])].sort((a, b) => rank[a.priority as keyof typeof rank] - rank[b.priority as keyof typeof rank]);
  return (
    <>
      <section className={card}>
        <p className="small text-ink-muted m-0">{o.dev.intro}</p>
        <RunAnalysis label={o.dev.run} busy={o.dev.running} />
      </section>
      <section className={card}>
        <div className="flex items-center gap-3">
          <h3 className="h3 m-0 grow">{o.dev.lastReport}</h3>
          {report && <span className="text-[12px] text-ink-faint">{date(report.created_at)} · {report.model ? textModel(report.model).name : ""}</span>}
        </div>
        {report ? <p className="body m-0 whitespace-pre-wrap" dir="auto">{report.summary}</p> : <p className="small text-ink-muted m-0">{o.dev.noReport}</p>}
      </section>
      <section className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="h3 m-0 grow">{o.dev.proposals}</h3>
          <nav className="mn-stagebar" aria-label={o.dev.proposals}>
            {STATUSES.map((s) => (
              <Link key={s} href={`/owner?s=development&status=${s}`} aria-current={s === shown ? "true" : undefined} className={`mn-stage ${s === shown ? "mn-stage--current" : ""}`}>
                {o.dev.statuses[s]}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-[12px] text-ink-faint m-0">{o.dev.ruleNote}</p>
        {list.length === 0 ? (
          <p className="small text-ink-muted m-0">{o.dev.noItems}</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col">
            {list.map((i) => (
              <li key={i.id} className="border-t border-line first:border-t-0 py-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`mn-chip ${i.priority === "high" ? "mn-chip--failed" : "mn-chip--waiting"}`}>{o.dev.priorities[i.priority as keyof typeof o.dev.priorities]}</span>
                  <span className="mn-chip mn-chip--ready">{o.dev.kinds[i.kind as keyof typeof o.dev.kinds]}</span>
                  <span className="body font-medium" dir="auto">{i.title}</span>
                </div>
                {i.detail && <p className="small m-0 whitespace-pre-wrap" dir="auto">{i.detail}</p>}
                {i.evidence && (
                  <p className="text-[12px] text-ink-muted m-0" dir="auto">
                    <span className="mn-label me-2">{o.dev.evidence}</span>
                    {i.evidence}
                  </p>
                )}
                <ItemActions id={i.id} status={i.status} c={o.dev} />
              </li>
            ))}
          </ul>
        )}
        <CopyForClaude items={accepted ?? []} label={o.dev.copy} copied={o.dev.copied} />
      </section>
    </>
  );
}

async function Models({ o, jobs, card }: { o: O; jobs: Awaited<ReturnType<typeof ownerOverview>>["jobs"]; card: string }) {
  const health = await modelHealth();
  const writing = new Set(TEXT_MODELS.map((m) => m.id));
  return (
    <>
      <section className={card}>
        <h3 className="h3 m-0">{o.health.title}</h3>
        {health.length === 0 ? (
          <p className="small text-ink-muted m-0">{o.health.none}</p>
        ) : (
          <table className="w-full border-collapse small">
            <thead>
              <tr>{[o.table.model, o.health.ok, o.health.failed, o.health.time, o.health.status].map((x) => <th key={x} className="mn-label text-start py-2 pe-4">{x}</th>)}</tr>
            </thead>
            <tbody>
              {health.map((h) => {
                const bad = h.failed > 0 && h.ok === 0;
                return (
                  <tr key={h.model} className="border-t border-line">
                    <td className="py-2 pe-4" lang="en">{writing.has(h.model) ? textModel(h.model).name : h.model}</td>
                    <td className="py-2 pe-4 data">{h.ok}</td>
                    <td className="py-2 pe-4 data">{h.failed}</td>
                    <td className="py-2 pe-4 data">{h.avgSeconds == null ? "–" : `${h.avgSeconds} s`}</td>
                    <td className="py-2 pe-4"><span className={`mn-chip ${bad ? "mn-chip--failed" : "mn-chip--ready"}`}>{bad ? o.health.bad : o.health.good}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section className={card}>
        <h3 className="h3 m-0">{o.byModel}</h3>
        <ModelTable rows={byModel(jobs)} h={o.table} />
      </section>
    </>
  );
}

async function Feedback({ o, admin, date, card }: { o: O; admin: Admin; date: (x: string) => string; card: string }) {
  const { data } = await admin.from("feedback").select("id, kind, text, page, created_at, message_id").order("created_at", { ascending: false }).limit(100);
  const ids = (data ?? []).map((f) => f.message_id).filter(Boolean) as string[];
  const { data: replies } = ids.length ? await admin.from("messages").select("id, content").in("id", ids) : { data: [] };
  return (
    <section className={card}>
      {!data?.length ? (
        <p className="small text-ink-muted m-0">{o.fb.none}</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col">
          {data.map((f) => {
            const reply = replies?.find((r) => r.id === f.message_id)?.content;
            return (
              <li key={f.id} className="border-t border-line first:border-t-0 py-3 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`mn-chip ${f.kind === "down" || f.kind === "bug" ? "mn-chip--failed" : "mn-chip--ready"}`}>{o.fb.kinds[f.kind as keyof typeof o.fb.kinds]}</span>
                  <span className="text-[12px] text-ink-faint">{date(f.created_at)}{f.page ? ` · ${f.page}` : ""}</span>
                </div>
                {f.text && <p className="small m-0" dir="auto">{f.text}</p>}
                {reply && <p className="text-[12px] text-ink-muted m-0 line-clamp-2" dir="auto">{reply}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

async function Rules({ o, admin, card }: { o: O; admin: Admin; card: string }) {
  const { data } = await admin.from("ai_rules").select("id, text, active").order("created_at");
  return (
    <section className={card}>
      <p className="small text-ink-muted m-0">{o.rules.intro}</p>
      <RuleForm c={o.rules} />
      {!data?.length ? (
        <p className="small text-ink-muted m-0">{o.rules.none}</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col">
          {data.map((r) => (
            <li key={r.id} className="border-t border-line first:border-t-0 py-2.5 flex items-start gap-3">
              <span className={`mn-chip ${r.active ? "mn-chip--ready" : "mn-chip--waiting"} shrink-0`}>{r.active ? o.rules.on : o.rules.off}</span>
              <span className="small grow" dir="auto">{r.text}</span>
              <RuleActions id={r.id} active={r.active} c={o.rules} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function Tools({ o, admin, card }: { o: O; admin: Admin; card: string }) {
  const [{ data: ready }, { count }] = await Promise.all([
    admin.from("translations").select("locale").eq("version", DICTIONARY_VERSION),
    admin.from("memories").select("id", { count: "exact", head: true }),
  ]);
  const done = new Set((ready ?? []).map((r) => r.locale));
  return (
    <>
      <section className={card}>
        <h3 className="h3 m-0">{o.tools.languages}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(MACHINE_LOCALES).map(([code, l]) => (
            <span key={code} className={`mn-chip ${done.has(code) ? "mn-chip--ready" : "mn-chip--waiting"}`}>
              {l.name} · {done.has(code) ? o.tools.ready : o.tools.notReady}
            </span>
          ))}
        </div>
        <PrepareLanguages label={o.tools.prepare} busy={o.tools.preparing} />
      </section>
      <section className={card}>
        <h3 className="h3 m-0">{o.tools.memory}</h3>
        <p className="small m-0">{fill(o.tools.memories, { n: count ?? 0 })}</p>
      </section>
    </>
  );
}
