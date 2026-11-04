import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LangSwitch } from "@/components/lang-switch";
import { StageBar } from "@/components/stage/stage-bar";
import { StatusChip, type OutputStatus } from "@/components/status-chip";
import { ESTIMATE, missingRequired, type BriefFields, type StageOneDocs } from "@/lib/ai/brain";
import { fill, type Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { stageNumbersFor, type Path } from "@/lib/projects";
import { stagesFor } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";
import { BriefChat } from "./brief-chat";
import { PathButtons, StageFooter } from "./stage-controls";

// AI calls run inside the actions on this page and can take up to a minute.
export const maxDuration = 120;

const money = (n: number) => `⁦$${n.toFixed(2)}⁩`;
const MILESTONE: Record<number, string> = { 2: "M3", 3: "M4", 4: "M6", 5: "M5", 6: "v2", 7: "M7" };

type Output = { id: string; number: number; stage: number; status: OutputStatus | "failed"; current_version: number };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { id } = await params;
  const { o } = await searchParams;
  const me = await getCurrentMember();
  if (!me) redirect("/");
  const { locale, t } = await getI18n();
  const p = t.project;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client, path, path_suggested, path_reason, brief, current_stage")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: outputs }, { data: messages }, { data: jobs }] = await Promise.all([
    supabase.from("outputs").select("id, number, stage, status, current_version").eq("project_id", id).order("number"),
    supabase.from("messages").select("id, role, kind, content, audio_seconds").eq("project_id", id).order("created_at"),
    supabase.from("ai_jobs").select("cost_usd").eq("project_id", id),
  ]);
  const outs = (outputs ?? []) as Output[];
  const spent = (jobs ?? []).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);

  const path = project.path as Path | null;
  const order = stageNumbersFor(path);
  const names = stagesFor(path ?? "none", t.stage.names);
  const currentIndex = Math.max(0, order.indexOf(project.current_stage));
  const canEdit = ["admin", "producer", "coordinator"].includes(me.role);
  const brief = (project.brief ?? {}) as Partial<BriefFields>;
  const missing = missingRequired(brief);

  // Latest content of the stage 1 documents.
  const docIds = outs.filter((x) => x.stage === 1 && x.number >= 3 && x.current_version > 0);
  const docs: Record<number, unknown> = {};
  if (docIds.length) {
    const { data: versions } = await supabase
      .from("versions")
      .select("output_id, version, content")
      .in("output_id", docIds.map((x) => x.id));
    for (const x of docIds) {
      docs[x.number] = versions?.find((v) => v.output_id === x.id && v.version === x.current_version)?.content;
    }
  }

  const stage = project.current_stage;
  const stageOne = outs.filter((x) => x.stage === 1);
  const docsReady = [3, 4, 5, 6].every((n) => ["ready", "edited", "approved"].includes(stageOne.find((x) => x.number === n)?.status ?? ""));
  const stageOneApproved = stageOne.length > 0 && stageOne.every((x) => x.status === "approved");
  const open = Number(o) || (stage === 1 ? (docsReady ? 3 : 1) : 0);

  const header = (
    <header className="flex flex-wrap items-center gap-3 px-5 py-3 bg-surface border-b border-line">
      <Link href="/projects" aria-label={p.back}>
        <Image src="/brand/menab-logo-light.png" alt="Menab" width={111} height={20} priority style={{ height: 20, width: "auto" }} />
      </Link>
      <span className="text-line-strong" aria-hidden="true">/</span>
      <span className="text-[15px] font-medium">{project.name}</span>
      <span className="mn-chip mn-chip--ready">{path ? t.stage.paths[path] : t.stage.paths.none}</span>
      <span className="grow" />
      <span className="mn-label">{fill(p.spent, { spent: money(spent) })}</span>
      <LangSwitch to={locale === "ar" ? "en" : "ar"} label={t.langSwitch} ariaLabel={t.langSwitchLabel} />
    </header>
  );

  // ---------- Stage 2 and later: layout with the outputs list, built in later milestones ----------
  const viewingBrief = Number(o) >= 1 && Number(o) <= 6;
  if (stage !== 1 && !viewingBrief) {
    const list = outs.filter((x) => x.stage === stage);
    return (
      <div className="min-h-screen flex flex-col">
        {header}
        <div className="px-5 py-3"><StageBar stages={names} current={currentIndex} label={t.stage.stagesLabel} /></div>
        <main className="flex-1 px-5 pb-5 flex flex-wrap gap-4 items-start">
          <nav aria-label={t.stage.outputsLabel} className="flex-[0_0_240px] max-w-[240px] bg-ground-deep border border-line rounded-lg p-3 flex flex-col gap-1">
            <span className="mn-label p-2">{fill(t.stage.outputsCount, { n: currentIndex + 1, count: list.length })}</span>
            {list.map((x) => (
              <div key={x.id} className="flex justify-between items-center gap-2 p-2 rounded-md text-[13px] text-ink-muted">
                {t.outputs[x.number]}
                <StatusChip status="waiting" label={t.status.waiting} />
              </div>
            ))}
          </nav>
          <section className="flex-1 min-w-[320px] bg-surface border border-line rounded-lg p-6">
            <h1 className="h2 m-0 mb-2">{names[currentIndex]}</h1>
            <p className="body text-ink-muted m-0">{fill(p.later, { m: MILESTONE[stage] ?? "" })}</p>
            <p className="small m-0 mt-4"><Link href={`/p/${id}?o=3`} className="underline">{t.outputs[3]}</Link></p>
          </section>
        </main>
      </div>
    );
  }

  // ---------- Stage 1: Brief ----------
  const tabs = [
    { o: 1, label: p.chat, status: (stageOne.find((x) => x.number === 1)?.status ?? "waiting") as OutputStatus },
    ...[3, 4, 5, 6].map((n) => ({ o: n, label: t.outputs[n], status: (stageOne.find((x) => x.number === n)?.status ?? "waiting") as OutputStatus })),
  ];

  let footerMessage = p.footerReview;
  let footerAction: "write" | "approve" | null = "approve";
  let footerLabel = fill(t.stage.approve, { n: 1 });
  let footerCost: string | undefined;
  if (stageOneApproved) {
    footerMessage = p.footerApproved;
    footerAction = null;
  } else if (missing.length) {
    footerMessage = fill(p.footerMissing, { fields: missing.map((k) => p.fields[k]).join(locale === "ar" ? "، " : ", ") });
    footerAction = "write";
    footerLabel = p.writeDocs;
    footerCost = `~${money(ESTIMATE.stageOne)}`;
  } else if (!docsReady) {
    footerMessage = p.footerReady;
    footerAction = "write";
    footerLabel = p.writeDocs;
    footerCost = `~${money(ESTIMATE.stageOne)}`;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <div className="px-5 py-3 flex flex-wrap gap-3 items-center justify-between">
        <StageBar stages={names} current={currentIndex} label={t.stage.stagesLabel} />
        <nav className="mn-stagebar" aria-label={t.stage.outputsLabel}>
          {tabs.map((tab) => (
            <Link
              key={tab.o}
              href={`/p/${id}?o=${tab.o}`}
              aria-current={open === tab.o ? "page" : undefined}
              className={`mn-stage ${open === tab.o ? "mn-stage--current" : ""}`}
            >
              {tab.label}
              {tab.status === "generating" && <span className="mn-chip__icon" style={{ border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", width: 10, height: 10, animation: "mn-spin .9s linear infinite" }} aria-label={t.status.generating} />}
              {(tab.status === "ready" || tab.status === "approved" || tab.status === "edited") && <span aria-label={t.status[tab.status]}>✓</span>}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-5 pb-5 flex flex-wrap gap-4 items-start">
        {open === 1 || open === 2 ? (
          <>
            <BriefChat
              projectId={id}
              canEdit={canEdit && stage === 1 && !stageOneApproved}
              cost={`~${money(ESTIMATE.briefTurn)}`}
              messages={(messages ?? []) as never}
              copy={p}
            />
            <aside className="w-full md:w-[320px] shrink-0 flex flex-col gap-4">
              <BriefPanel brief={brief} p={p} missing={missing} />
              <section className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
                <span className="mn-label">{p.suggestedPath}</span>
                {project.path_suggested ? (
                  <>
                    <h2 className="h3 m-0">{t.stage.paths[project.path_suggested as Path]}</h2>
                    {project.path_reason && <p className="small text-ink-muted m-0" dir="auto">{project.path_reason}</p>}
                  </>
                ) : (
                  <p className="small text-ink-muted m-0">{p.pathNone}</p>
                )}
                <PathButtons
                  projectId={id}
                  current={path}
                  chosenLabel={p.chosen}
                  disabled={!canEdit || stage !== 1 || stageOneApproved}
                  options={[
                    { path: "ai", label: p.useAi },
                    { path: "production", label: p.useProduction },
                    { path: "hybrid", label: p.useHybrid },
                  ]}
                />
              </section>
            </aside>
          </>
        ) : (
          <section className="flex-1 min-w-0 bg-surface border border-line rounded-lg">
            <div className="px-5 py-4 border-b border-line flex items-center gap-3">
              <div className="grow flex flex-col gap-1">
                <span className="mn-label" lang="en">
                  {String(open).padStart(2, "0")} · v{stageOne.find((x) => x.number === open)?.current_version ?? 0}
                </span>
                <h1 className="h2 m-0">{t.outputs[open]}</h1>
              </div>
              <StatusChip status={(stageOne.find((x) => x.number === open)?.status ?? "waiting") as OutputStatus} label={t.status[(stageOne.find((x) => x.number === open)?.status ?? "waiting") as OutputStatus] ?? p.docs.failed} />
            </div>
            <div className="p-5">
              <DocView n={open} content={docs[open]} p={p} />
            </div>
          </section>
        )}
      </main>

      {canEdit && stage === 1 && (
        <StageFooter
          projectId={id}
          stage={1}
          message={footerMessage}
          action={footerAction}
          label={footerLabel}
          cost={footerCost}
          busyLabel={footerAction === "write" ? p.writing : undefined}
          disabled={footerAction === "write" && missing.length > 0}
        />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5">
      <span className="small text-ink-muted">{label}</span>
      <span className="small" dir="auto" style={{ textAlign: "start" }}>{children}</span>
    </div>
  );
}

function BriefPanel({ brief, p, missing }: { brief: Partial<BriefFields>; p: Dictionary["project"]; missing: string[] }) {
  const show = (k: Exclude<keyof BriefFields, "project_name">) => {
    const v = brief[k];
    if (missing.includes(k)) return <span className="mn-chip mn-chip--failed">{p.missing}</span>;
    if (k === "budget" && !v) return <span className="mn-chip mn-chip--waiting">{p.optional}</span>;
    if (k === "length_seconds" && typeof v === "number") return fill(p.sec, { n: v });
    if (k === "real_products" || k === "real_people") return v === "yes" ? p.yes : v === "no" ? p.no : p.unknown;
    if (Array.isArray(v)) return v.length ? v.join(", ") : "–";
    return v ? String(v) : "–";
  };
  const keys: Exclude<keyof BriefFields, "project_name">[] = ["client", "product", "goal", "length_seconds", "cutdowns", "formats", "language", "real_products", "real_people", "locations", "deadline", "budget", "mandatories"];
  return (
    <section className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="h3 m-0">{p.brief}</h2>
        <span className="mn-label">{p.updates}</span>
      </div>
      {keys.map((k) => (
        <Row key={k} label={p.fields[k]}>{show(k)}</Row>
      ))}
    </section>
  );
}

function DocView({ n, content, p }: { n: number; content: unknown; p: Dictionary["project"] }) {
  if (!content) return <p className="body text-ink-muted m-0">{p.docs.notWritten}</p>;
  const d = p.docs;
  if (n === 3) {
    const c = content as StageOneDocs["summary"];
    return (
      <div className="flex flex-col gap-3 max-w-[760px]">
        <h2 className="h3 m-0">{c.title}</h2>
        {c.paragraphs.map((x, i) => <p key={i} className="body m-0 mn-prose">{x}</p>)}
      </div>
    );
  }
  if (n === 4) {
    const c = content as StageOneDocs["strategy"];
    return (
      <div className="flex flex-col gap-4 max-w-[860px]">
        <Row label={d.insight}>{c.insight}</Row>
        <Row label={d.keyMessage}>{c.key_message}</Row>
        <Row label={d.tone}>{c.tone}</Row>
        <Row label={d.platforms}>{c.platforms.join(", ")}</Row>
        <div>
          <h3 className="mn-label m-0 mb-2">{d.deliverables}</h3>
          <table className="w-full border-collapse small">
            <thead>
              <tr>{[d.deliverable, d.duration, d.ratio, d.platform].map((h) => <th key={h} className="mn-label text-start py-2 pe-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {c.deliverables.map((x, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="py-2 pe-3">{x.name}</td>
                  <td className="py-2 pe-3 data">{x.duration_seconds}s</td>
                  <td className="py-2 pe-3 data">{x.ratio}</td>
                  <td className="py-2 pe-3">{x.platform}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (n === 5) {
    const c = content as StageOneDocs["pathway"];
    return (
      <div className="flex flex-col gap-2 max-w-[860px]">
        <p className="body m-0 mb-2">{c.reason}</p>
        <Row label={d.aiScenes}>{c.ai_scenes.join(" · ") || "–"}</Row>
        <Row label={d.shootScenes}>{c.shoot_scenes.join(" · ") || "–"}</Row>
        <Row label={d.costRange}>{c.cost_range}</Row>
        <Row label={d.timeRange}>{c.time_range}</Row>
      </div>
    );
  }
  if (n === 6) {
    const c = content as { cps: StageOneDocs["cps"]; kickoff_notes: string[] };
    return (
      <div className="flex flex-col gap-4">
        <table className="w-full border-collapse small">
          <thead>
            <tr>{[d.milestones, d.from, d.to, d.phase].map((h) => <th key={h} className="mn-label text-start py-2 pe-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {c.cps.milestones.map((m, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-2 pe-3">{m.name}</td>
                <td className="py-2 pe-3 data" dir="ltr">{m.start}</td>
                <td className="py-2 pe-3 data" dir="ltr">{m.end}</td>
                <td className="py-2 pe-3"><span className="mn-chip mn-chip--waiting">{d.phases[m.phase]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small text-ink-muted m-0">{c.cps.note}</p>
        {c.kickoff_notes.length > 0 && (
          <div>
            <h3 className="mn-label m-0 mb-2">{d.kickoff}</h3>
            <ul className="m-0 ps-5 flex flex-col gap-1 list-disc">{c.kickoff_notes.map((x, i) => <li key={i} className="body">{x}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }
  return null;
}

