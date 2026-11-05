import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconLayoutBoard, IconLayoutPage } from "@/components/icons";
import { StageBar } from "@/components/stage/stage-bar";
import { StatusChip, type OutputStatus } from "@/components/status-chip";
import { missingRequired, type BriefFields, type StageOneDocs } from "@/lib/ai/brain";
import { DEFAULT_TEXT_MODEL, estimateUsd, TEXT_MODELS, textModel } from "@/lib/ai/catalog";
import { fill, type Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { stageNumbersFor, type Path } from "@/lib/projects";
import { stagesFor } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/workspace";
import { BriefChat } from "./brief-chat";
import { ChangeBox } from "./editors";
import { InlineDoc, InlineIdea } from "./inline-doc";
import { LanguageMenu } from "@/components/menus";
import { MenabLoader } from "@/components/menab-loader";
import { StepModelPicker } from "./side-panels";
import { PathButtons, RewriteButton, StageFooter } from "./stage-controls";

// AI calls run inside the actions on this page and can take up to a minute.
export const maxDuration = 120;

const iso = (x: string) => String.fromCharCode(0x2066) + x + String.fromCharCode(0x2069);
const money = (n: number) => iso(`$${n < 0.01 && n > 0 ? n.toFixed(3) : n.toFixed(2)}`);
// An estimate shown before an action, kept in reading order in Arabic.
const approx = (n: number) => iso(`~$${n.toFixed(2)}`);
const MILESTONE: Record<number, string> = { 2: "M3", 3: "M4", 4: "M6", 5: "M5", 6: "v2", 7: "M7" };

type Output = { id: string; number: number; stage: number; status: OutputStatus | "failed"; current_version: number };

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ o?: string; view?: string }>;
}) {
  const { id } = await params;
  const { o, view } = await searchParams;
  const { locale, uiLocale, t } = await getI18n();
  const p = t.project;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, workspace_id, name, client, path, path_suggested, path_reason, brief, current_stage, models")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();
  const me = (await getMemberships()).find((m) => m.workspace.id === project.workspace_id);
  if (!me) redirect("/");

  const [{ data: outputs }, { data: messages }, { data: jobs }, { data: setting }] = await Promise.all([
    supabase.from("outputs").select("id, number, stage, status, current_version").eq("project_id", id).order("number"),
    supabase.from("messages").select("id, role, kind, content, audio_seconds, attachments").eq("project_id", id).order("created_at"),
    supabase.from("ai_jobs").select("cost_usd").eq("project_id", id),
    supabase.from("model_settings").select("model_id").eq("workspace_id", project.workspace_id).eq("task", "text").maybeSingle(),
  ]);
  const outs = (outputs ?? []) as Output[];
  const spent = (jobs ?? []).reduce((s, j) => s + Number(j.cost_usd ?? 0), 0);

  const path = project.path as Path | null;
  const order = stageNumbersFor(path);
  const names = stagesFor(path ?? "none", t.stage.names);
  const stage = project.current_stage as number;
  const currentIndex = Math.max(0, order.indexOf(stage));
  const canEdit = ["admin", "producer", "coordinator"].includes(me.role);
  const brief = (project.brief ?? {}) as Partial<BriefFields>;
  const missing = missingRequired(brief);

  // Writing model: picked on this project, else the workspace default, else Menab's default.
  const workspaceDefault = setting?.model_id ?? DEFAULT_TEXT_MODEL;
  const model = textModel((project.models as { text?: string } | null)?.text ?? workspaceDefault).id;
  const modelOptions = TEXT_MODELS.map((m, i) => ({
    id: m.id,
    rank: i + 1,
    name: m.name,
    note: m.goodFor[locale],
    price: m.free
      ? locale === "ar" ? "مجاني، بحد يومي" : "Free, daily limit"
      : iso(`~$${estimateUsd(m.id, "briefTurn").toFixed(3)}`) + (locale === "ar" ? " للرد" : " a reply"),
  }));

  // Which stage the screen shows: the current one, or stage 1 when one of its outputs is opened.
  const stageOne = outs.filter((x) => x.stage === 1);
  const asked = Number(o);
  const showing = asked >= 1 && asked <= 6 ? 1 : stage;
  const list = showing === 1 ? stageOne.filter((x) => x.number !== 2) : outs.filter((x) => x.stage === showing);
  const docsReady = [3, 4, 5, 6].every((n) => ["ready", "edited", "approved"].includes(stageOne.find((x) => x.number === n)?.status ?? ""));
  const stageOneApproved = stageOne.length > 0 && stageOne.every((x) => x.status === "approved");
  const open = showing === 1 ? (asked >= 1 && asked <= 6 ? (asked === 2 ? 1 : asked) : docsReady ? 3 : 1) : 0;
  const board = view === "board";
  const editableHere = canEdit && showing === stage && !(showing === 1 && stageOneApproved);

  // Latest content of every stage 1 output, for the page and the board.
  const withVersions = stageOne.filter((x) => x.current_version > 0);
  const content: Record<number, unknown> = {};
  if (withVersions.length) {
    const { data: versions } = await supabase
      .from("versions")
      .select("output_id, version, content")
      .in("output_id", withVersions.map((x) => x.id));
    for (const x of withVersions) content[x.number] = versions?.find((v) => v.output_id === x.id && v.version === x.current_version)?.content;
  }

  const statusOf = (n: number) => (outs.find((x) => x.number === n)?.status ?? "waiting") as OutputStatus | "failed";
  const href = (q: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && sp.set(k, String(v)));
    const qs = sp.toString();
    return `/p/${id}${qs ? `?${qs}` : ""}`;
  };

  // Footer for stage 1.
  let footerMessage = p.footerReview;
  let footerAction: "write" | "approve" | null = "approve";
  let footerLabel = fill(t.stage.approve, { n: 1 });
  let footerCost: string | undefined;
  if (stageOneApproved) {
    footerMessage = p.footerApproved;
    footerAction = null;
  } else if (missing.length || !docsReady) {
    footerMessage = missing.length ? fill(p.footerMissing, { fields: missing.map((k) => p.fields[k]).join(locale === "ar" ? "، " : ", ") }) : p.footerReady;
    footerAction = "write";
    footerLabel = p.writeDocs;
    footerCost = approx(estimateUsd(model, "stageOne"));
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Project bar */}
      <header className="flex flex-wrap items-center gap-3 px-6 h-14 border-b border-line bg-surface">
        <Link href="/projects" className="small text-ink-muted hover:text-ink">{t.projects.title}</Link>
        <span className="text-line-strong" aria-hidden="true">/</span>
        <span className="text-[15px] font-medium truncate max-w-[40ch]">{project.name}</span>
        <span className="mn-chip mn-chip--ready">{path ? t.stage.paths[path] : t.stage.paths.none}</span>
        <span className="grow" />
        <span className="mn-label h-9 px-3 rounded-md border border-line grid place-items-center">{fill(p.spent, { spent: money(spent) })}</span>
        <LanguageMenu locale={uiLocale} label={t.settings.language} soon={t.frame.preparing} compact={false} placement="down" />
      </header>

      {/* Stages, and Page or Board */}
      <div className="px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <StageBar stages={names} current={currentIndex} label={t.stage.stagesLabel} />
        <div className="mn-stagebar" role="group" aria-label={t.stage.viewLabel}>
          <Link href={href({ o: open || undefined })} aria-current={!board ? "true" : undefined} className={`mn-stage ${!board ? "mn-stage--current" : ""}`}>
            <IconLayoutPage size={14} />
            {t.stage.page}
          </Link>
          <Link href={href({ o: showing === 1 ? 1 : undefined, view: "board" })} aria-current={board ? "true" : undefined} className={`mn-stage ${board ? "mn-stage--current" : ""}`}>
            <IconLayoutBoard size={14} />
            {t.stage.board}
          </Link>
        </div>
      </div>

      {board ? (
        <main className="flex-1 px-6 pb-6 flex flex-wrap gap-4 items-start">
          <div className="mn-board flex-[999_1_560px] min-h-[560px] flex flex-wrap gap-6 content-start">
            {list.map((x) => (
              <Link key={x.id} href={href({ o: showing === 1 ? x.number : undefined })} className={`mn-card ${statusOf(x.number) === "generating" ? "mn-card--ai" : ""}`} style={{ width: 260 }}>
                <div className="mn-card__head">
                  <span className="mn-label" lang="en">{String(x.number).padStart(2, "0")}</span>
                  <StatusChip status={statusOf(x.number) as OutputStatus} label={statusLabel(t, statusOf(x.number))} />
                </div>
                <p className="mn-card__title">{t.outputs[x.number]}</p>
                <p className={`mn-card__text ${statusOf(x.number) === "generating" ? "mn-typing" : ""}`} dir="auto" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {excerpt(x.number, content[x.number], brief, p) || (showing === 1 ? "" : fill(p.later, { m: MILESTONE[showing] ?? "" }))}
                </p>
                <div className="mn-card__meta">
                  <span>{x.current_version > 0 ? textModel(model).name : ""}</span>
                  <span>{x.current_version > 0 ? `v${x.current_version}` : ""}</span>
                </div>
              </Link>
            ))}
          </div>
          <aside className="flex-[1_1_280px] max-w-[320px] min-w-0 bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
            <h2 className="m-0 text-[16px] font-medium">{t.stage.assistant}</h2>
            <div className="flex flex-col gap-1.5">
              <span className="mn-label">{p.model}</span>
              <StepModelPicker projectId={id} label={p.model} options={modelOptions} value={model} defaultLabel={model === workspaceDefault ? p.defaultTag : ""} disabled={!canEdit} />
            </div>
            {showing === 1 && docsReady && editableHere && (
              <ChangeBox projectId={id} copy={p.change} cost={approx(estimateUsd(model, "stageOne"))} />
            )}
          </aside>
        </main>
      ) : (
        <main className="flex-1 px-6 pb-6 flex flex-wrap gap-4 items-start">
          {/* Steps of the stage */}
          <nav aria-label={t.stage.outputsLabel} className="flex-[0_0_248px] max-w-[248px] bg-ground-deep border border-line rounded-lg p-3 flex flex-col gap-1">
            <span className="mn-label p-2">{fill(t.stage.outputsCount, { n: order.indexOf(showing) + 1, count: list.length })}</span>
            {list.map((x) => {
              const st = statusOf(x.number);
              const isOpen = showing === 1 && open === x.number;
              const inner = (
                <>
                  <span className={st === "waiting" ? "text-ink-muted" : ""}>{x.number === 1 ? p.chat : t.outputs[x.number]}</span>
                  <StatusChip status={st as OutputStatus} label={statusLabel(t, st)} />
                </>
              );
              const cls = `flex justify-between items-center gap-2 p-2.5 rounded-md text-[14px] ${isOpen ? "font-medium bg-surface border border-line" : "border border-transparent hover:bg-tint-2"}`;
              return showing === 1 ? (
                <Link key={x.id} href={href({ o: x.number })} aria-current={isOpen ? "page" : undefined} className={cls}>{inner}</Link>
              ) : (
                <div key={x.id} className={cls}>{inner}</div>
              );
            })}
          </nav>

          {showing !== 1 ? (
            <section className="flex-[999_1_480px] min-w-0 bg-surface border border-line rounded-lg p-6">
              <span className="mn-label">{fill(t.projects.stageOf, { n: currentIndex + 1, total: order.length })}</span>
              <h1 className="h2 m-0 mt-1 mb-2">{names[currentIndex]}</h1>
              <p className="body text-ink-muted m-0">{fill(p.later, { m: MILESTONE[showing] ?? "" })}</p>
              <p className="small m-0 mt-4"><Link href={href({ o: 3 })} className="underline">{t.outputs[3]}</Link></p>
            </section>
          ) : open === 1 ? (
            <div className="flex-[999_1_480px] min-w-0 flex">
              <BriefChat
                projectId={id}
                canEdit={editableHere}
                cost={approx(estimateUsd(model, "briefTurn"))}
                messages={(messages ?? []) as never}
                copy={p}
                models={modelOptions.map((m) => ({ id: m.id, name: m.name, price: m.price }))}
                model={model}
              />
            </div>
          ) : (
            <section className="flex-[999_1_480px] min-w-0 bg-surface border border-line rounded-lg">
              <div className="px-6 py-5 border-b border-line flex items-center gap-3">
                <div className="grow flex flex-col gap-1">
                  <span className="mn-label" lang="en">{String(open).padStart(2, "0")} · v{outs.find((x) => x.number === open)?.current_version ?? 0}</span>
                  <h1 className="h2 m-0">{t.outputs[open]}</h1>
                </div>
                <StatusChip status={statusOf(open) as OutputStatus} label={statusLabel(t, statusOf(open))} />
              </div>
              <div className="p-6">
                {content[open] ? (
                  <InlineDoc
                    projectId={id}
                    n={open}
                    content={content[open]}
                    d={p.docs}
                    editable={editableHere && statusOf(open) !== "generating"}
                    savedNote={p.editCopy.saved}
                  />
                ) : statusOf(open) === "generating" ? (
                  <MenabLoader size={20} label={p.writing} />
                ) : (
                  <p className="body text-ink-muted m-0">{p.docs.notWritten}</p>
                )}
              </div>
            </section>
          )}

          {/* Right panel: the brief while talking, the assistant on documents */}
          <aside className="flex-[1_1_300px] max-w-[340px] min-w-0 flex flex-col gap-4">
            {showing === 1 && open === 1 ? (
              <>
                <BriefPanel brief={brief} p={p} missing={missing} projectId={id} editable={editableHere} />
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
                    disabled={!editableHere}
                    options={[
                      { path: "ai", label: p.useAi },
                      { path: "production", label: p.useProduction },
                      { path: "hybrid", label: p.useHybrid },
                    ]}
                  />
                </section>
              </>
            ) : null}
            <section className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h2 className="m-0 text-[16px] font-medium">{t.stage.assistant}</h2>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="mn-label">{p.model}</span>
                <StepModelPicker
                  projectId={id}
                  label={p.model}
                  options={modelOptions}
                  value={model}
                  defaultLabel={model === workspaceDefault ? p.defaultTag : ""}
                  disabled={!canEdit}
                />
              </div>
              {showing === 1 && open !== 1 && docsReady && editableHere && (
                <>
                  <ChangeBox projectId={id} copy={p.change} cost={approx(estimateUsd(model, "stageOne"))} />
                  <RewriteButton projectId={id} label={p.rewrite} cost={approx(estimateUsd(model, "stageOne"))} />
                </>
              )}
            </section>
          </aside>
        </main>
      )}

      {canEdit && showing === 1 && stage === 1 && (
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

function statusLabel(t: Dictionary, s: string) {
  if (s === "failed") return t.project.docs.failed;
  return t.status[s as keyof Dictionary["status"]] ?? s;
}

function excerpt(n: number, c: unknown, brief: Partial<BriefFields>, p: Dictionary["project"]): string {
  if (n === 1) return brief.logline ?? "";
  if (!c) return "";
  if (n === 3) return (c as StageOneDocs["summary"]).paragraphs?.[0] ?? "";
  if (n === 4) return (c as StageOneDocs["strategy"]).key_message ?? "";
  if (n === 5) return (c as StageOneDocs["pathway"]).reason ?? "";
  if (n === 6) {
    const m = (c as { cps: StageOneDocs["cps"] }).cps?.milestones ?? [];
    return m.length ? `${m[0].name} ${m[0].start} · ${m[m.length - 1].name} ${m[m.length - 1].end}` : p.docs.notWritten;
  }
  return "";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 py-1.5">
      <span className="small text-ink-muted">{label}</span>
      <span className="small" dir="auto" style={{ textAlign: "start" }}>{children}</span>
    </div>
  );
}

// The brief panel starts from the video itself, then delivery, production, and client and timing.
function BriefPanel({ brief, p, missing, projectId, editable }: { brief: Partial<BriefFields>; p: Dictionary["project"]; missing: string[]; projectId: string; editable: boolean }) {
  type K = Exclude<keyof BriefFields, "project_name">;
  const show = (k: K) => {
    const v = brief[k];
    if (missing.includes(k)) return <span className="mn-chip mn-chip--failed">{p.missing}</span>;
    if (k === "budget" && !v) return <span className="mn-chip mn-chip--waiting">{p.optional}</span>;
    if (k === "length_seconds" && typeof v === "number") return fill(p.sec, { n: v });
    if (k === "real_products" || k === "real_people") return v === "yes" ? p.yes : v === "no" ? p.no : p.unknown;
    if (Array.isArray(v)) return v.length ? v.join(", ") : "–";
    return v ? String(v) : "–";
  };
  const group = (title: string, keys: K[]) => (
    <div className="flex flex-col">
      <span className="mn-label pt-3 pb-1">{title}</span>
      {keys.map((k) => <Row key={k} label={p.fields[k]}>{show(k)}</Row>)}
    </div>
  );
  return (
    <section className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="h3 m-0">{p.brief}</h2>
        <span className="mn-label">{p.updates}</span>
      </div>
      {/* What Menab understands about the video */}
      <div className="mt-2 rounded-md bg-ground-deep border border-line p-3 flex flex-col gap-2">
        <span className="mn-label">{p.understanding}</span>
        {brief.logline ? (
          <InlineIdea projectId={projectId} logline={brief.logline} story={brief.story ?? []} editable={editable} labels={{ idea: p.editCopy.idea, story: p.editCopy.story }} />
        ) : (
          <p className="small text-ink-faint m-0">{p.start}</p>
        )}
        {brief.logline && <span className="text-[11px] text-ink-faint">{p.draft}</span>}
      </div>
      {group(p.sections.video, ["objective", "audience", "feeling", "key_message", "must_show"])}
      {group(p.sections.delivery, ["length_seconds", "cutdowns", "formats", "language"])}
      {group(p.sections.production, ["real_products", "real_people", "locations"])}
      {group(p.sections.client, ["client", "product", "deadline", "budget"])}
    </section>
  );
}
