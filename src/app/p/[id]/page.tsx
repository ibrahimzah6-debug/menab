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
import { BoardCanvas } from "./board-canvas";
import { BoardCardText, InlineDoc, InlineIdea } from "./inline-doc";
import { LanguageMenu } from "@/components/menus";
import { MenabLoader } from "@/components/menab-loader";
import { StepModelPicker } from "./side-panels";
import { PathButtons, RewriteButton, StageFooter } from "./stage-controls";
import { DirectionsView, MeetingView, MoodView, ScriptView, TreatmentView, Versions } from "./creative-docs";
import { AutoRefresh, CreativeAssistant, CreativeStart, TryAgain } from "./creative-panels";
import { ProjectMenu } from "./project-menu";
import { PanelTabs } from "./panel-tabs";
import { BoardCursor, TypeIn } from "./board-live";

// AI calls run inside the actions on this page and can take up to a minute.
export const maxDuration = 300;

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
    supabase.from("outputs").select("id, number, stage, status, current_version, updated_at").eq("project_id", id).order("number"),
    supabase.from("messages").select("id, role, kind, content, audio_seconds, attachments, steps").eq("project_id", id).order("created_at"),
    supabase.from("ai_jobs").select("cost_usd").eq("project_id", id),
    supabase.from("model_settings").select("model_id").eq("workspace_id", project.workspace_id).eq("task", "text").maybeSingle(),
  ]);
  // A piece still marked as being written after 6 minutes died with its run: show it as failed,
  // so "Try again" appears instead of a spinner that never ends.
  const staleBefore = Date.now() - 6 * 60_000;
  const outs = ((outputs ?? []) as (Output & { updated_at: string })[]).map((x) =>
    x.status === "generating" && new Date(x.updated_at).getTime() < staleBefore ? { ...x, status: "failed" as const } : x,
  );
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
    price: iso(`~$${estimateUsd(m.id, "briefTurn").toFixed(3)}`) + (locale === "ar" ? " للرد" : " a reply"),
  }));

  // Which stage the screen shows: the current one, or an earlier one when one of its outputs is opened.
  const stageOne = outs.filter((x) => x.stage === 1);
  const stageTwo = outs.filter((x) => x.stage === 2);
  const asked = Number(o);
  const showing = asked >= 1 && asked <= 6 ? 1 : asked >= 7 && asked <= 12 && stageTwo.length ? 2 : stage;
  const list = showing === 1 ? stageOne.filter((x) => x.number !== 2) : outs.filter((x) => x.stage === showing);
  const isReady = (n: number) => ["ready", "edited", "approved"].includes(outs.find((x) => x.number === n)?.status ?? "");
  const docsReady = [3, 4, 5, 6].every(isReady);
  const stageOneApproved = stageOne.length > 0 && stageOne.every((x) => x.status === "approved");
  const stageTwoApproved = stageTwo.length > 0 && stageTwo.every((x) => x.status === "approved");
  // The open output: the one asked for, else where the work is.
  const open =
    showing === 1
      ? asked >= 1 && asked <= 6 ? (asked === 2 ? 1 : asked) : docsReady ? 3 : 1
      : showing === 2
        ? asked >= 7 && asked <= 12 ? asked : isReady(12) ? 12 : isReady(8) ? 9 : isReady(7) ? 8 : 7
        : 0;
  const board = view === "board";
  const editableHere = canEdit && showing === stage && !(showing === 1 && stageOneApproved) && !(showing === 2 && stageTwoApproved);
  const generating = outs.some((x) => x.status === "generating");

  // Latest content of every stage 1 and stage 2 output, for the page and the board.
  const withVersions = [...stageOne, ...stageTwo].filter((x) => x.current_version > 0);
  const content: Record<number, unknown> = {};
  if (withVersions.length) {
    const { data: versions } = await supabase
      .from("versions")
      .select("output_id, version, content")
      .in("output_id", withVersions.map((x) => x.id));
    for (const x of withVersions) content[x.number] = versions?.find((v) => v.output_id === x.id && v.version === x.current_version)?.content;
  }

  // Every version of the open output, to restore an earlier one.
  const openOut = outs.find((x) => x.number === open);
  const { data: versionList } = openOut && openOut.current_version > 1
    ? await supabase.from("versions").select("version, source, created_at").eq("output_id", openOut.id).order("version")
    : { data: [] };

  const runCopy = {
    thinking: p.thinking,
    outputs: t.outputs as unknown as Record<number, string>,
    steps: { call: p.steps.call, retry: p.steps.retry, switch: p.steps.switch, skip: p.steps.skip, writing: t.creative.steps.writing, saved: t.creative.steps.saved, stopped: p.steps.stopped, lost: p.steps.lost, stop: p.steps.stop },
  };
  const seconds = Number(brief.length_seconds) || 30;
  const meeting = (content[8] ?? {}) as { chosen?: number; notes?: string };

  // The board shows every stage up to the current one.
  const boardStages = order
    .filter((n) => order.indexOf(n) <= currentIndex)
    .map((n) => ({
      stage: n,
      index: order.indexOf(n),
      name: names[order.indexOf(n)] ?? "",
      approved: outs.filter((x) => x.stage === n).length > 0 && outs.filter((x) => x.stage === n).every((x) => x.status === "approved"),
      outs: outs.filter((x) => x.stage === n && x.number !== 2),
    }));
  const busyOut = outs.find((x) => x.status === "generating");

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
    // On a computer the screen is one fixed height: the reply box stays at the bottom and each
    // column scrolls on its own. On a phone the columns stack and the page scrolls.
    <div className="flex flex-col md:h-screen md:overflow-hidden">
      {/* Project bar */}
      <header className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-6 py-2 min-h-14 border-b border-line bg-surface">
        <Link href="/projects" className="small text-ink-muted hover:text-ink">{t.projects.title}</Link>
        <span className="text-line-strong" aria-hidden="true">/</span>
        <span className="text-[15px] font-medium truncate min-w-0 max-w-[40ch]">{project.name}</span>
        <span className="mn-chip mn-chip--ready">{path ? t.stage.paths[path] : t.stage.paths.none}</span>
        <span className="grow" />
        <span className="mn-label h-9 px-3 rounded-md border border-line grid place-items-center">{fill(p.spent, { spent: money(spent) })}</span>
        <LanguageMenu locale={uiLocale} label={t.settings.language} soon={t.frame.preparing} compact={false} placement="down" />
        {["admin", "producer"].includes(me.role) && <ProjectMenu projectId={id} name={project.name} c={t.stage.projectMenu} />}
      </header>

      {/* Stages, and Page or Board */}
      <div className="shrink-0 px-4 md:px-6 py-3 flex flex-wrap gap-3 items-center justify-between min-w-0">
        <StageBar
          stages={names}
          current={currentIndex}
          label={t.stage.stagesLabel}
          viewing={order.indexOf(showing)}
          links={order.map((n, i) => (i > currentIndex ? null : i === currentIndex ? href({}) : n === 1 ? href({ o: 1 }) : n === 2 ? href({ o: 7 }) : null))}
        />
        <span className="grow" />
        {busyOut && (
          <span className="h-8 px-3 rounded-full border border-line-control bg-surface flex items-center gap-2 small" role="status">
            <span className="mn-pulse" aria-hidden="true" style={{ width: 8, height: 8 }} />
            {fill(t.stage.writingNow, { name: t.outputs[busyOut.number] ?? "" })}
          </span>
        )}
        <div className="mn-stagebar" role="group" aria-label={t.stage.viewLabel}>
          <Link href={href({ o: open || undefined })} aria-current={!board ? "true" : undefined} className={`mn-stage ${!board ? "mn-stage--current" : ""}`}>
            <IconLayoutPage size={14} />
            {t.stage.page}
          </Link>
          <Link href={href({ o: showing === 1 ? 1 : showing === 2 ? 7 : undefined, view: "board" })} aria-current={board ? "true" : undefined} className={`mn-stage ${board ? "mn-stage--current" : ""}`}>
            <IconLayoutBoard size={14} />
            {t.stage.board}
          </Link>
        </div>
      </div>

      {board ? (
        <main className="flex-1 min-h-0 px-4 md:px-6 pb-4 flex flex-col md:flex-row gap-4">
          <BoardCanvas labels={{ zoomIn: t.stage.zoomIn, zoomOut: t.stage.zoomOut, reset: t.stage.zoomReset }}>
            {/* Every stage up to the current one: earlier stages stay on the canvas, read only. */}
            {boardStages.map((g) => (
              <section key={g.stage} className="flex flex-col gap-3" aria-label={g.name}>
                <div className="flex items-center gap-2">
                  <span className="mn-label" lang="en">{String(g.index + 1).padStart(2, "0")}</span>
                  <span className="small font-medium">{g.name}</span>
                  {g.approved && <span className="mn-chip mn-chip--approved">{t.status.approved}</span>}
                </div>
                <div className="flex flex-wrap gap-6 items-start">
                  {g.outs.map((x) => {
                    const st = statusOf(x.number);
                    const live = g.stage === stage && !g.approved;
                    const fresh = ["ready", "edited"].includes(st) && Date.now() - new Date(x.updated_at).getTime() < 25_000;
                    const text = g.stage === 1 ? excerpt(x.number, content[x.number], brief, p) : g.stage === 2 ? creativeExcerpt(x.number, content, meeting, t) : "";
                    if (st === "waiting" || (st === "failed" && !x.current_version)) {
                      return (
                        <article key={x.id} className="rounded-[10px] border border-dashed border-line-control bg-tint-1 p-4 flex flex-col gap-2" style={{ width: 240 }}>
                          <div className="flex justify-between items-center gap-2">
                            <span className="mn-label">{String(x.number).padStart(2, "0")} {t.outputs[x.number]}</span>
                            <StatusChip status={st as OutputStatus} label={statusLabel(t, st)} />
                          </div>
                          <p className="m-0 text-[13px] leading-5 text-ink-faint">{st === "failed" ? t.creative.redo.failed : g.stage <= 2 ? startsWhen(x.number, t) : fill(p.later, { m: MILESTONE[g.stage] ?? "" })}</p>
                          {(g.stage === 1 || g.stage === 2) && <Link href={href({ o: x.number })} className="text-[12px] underline text-ink-muted self-start">{p.openPage}</Link>}
                        </article>
                      );
                    }
                    return (
                      <article
                        key={x.id}
                        data-ai-busy={st === "generating" ? "" : undefined}
                        className={`mn-card ${st === "generating" ? "mn-card--ai" : ""} ${fresh ? "mn-card-pop" : ""}`}
                        style={{ width: 260, maxWidth: "100%", opacity: live || g.stage === showing ? 1 : 0.85 }}
                      >
                        <div className="mn-card__head">
                          <span className="mn-label" lang="en">{String(x.number).padStart(2, "0")}</span>
                          <StatusChip status={st as OutputStatus} label={statusLabel(t, st)} />
                        </div>
                        {st === "generating" && <div data-ai-spot className="mn-skeleton h-[72px] mb-2" />}
                        <p className="mn-card__title">{t.outputs[x.number]}</p>
                        <div className={`mn-card__text ${st === "generating" ? "mn-typing" : ""}`}>
                          {g.stage === 1 && live ? (
                            <BoardCardText
                              projectId={id}
                              n={x.number}
                              content={content[x.number]}
                              logline={brief.logline ?? ""}
                              story={brief.story ?? []}
                              fallback={text}
                              editable={editableHere && st !== "generating"}
                              label={t.outputs[x.number]}
                            />
                          ) : st === "generating" ? (
                            ""
                          ) : (
                            <TypeIn text={text} fresh={fresh} />
                          )}
                        </div>
                        <div className="mn-card__meta">
                          <span>{x.current_version > 0 ? `v${x.current_version}` : ""}</span>
                          {(g.stage === 1 || g.stage === 2) && <Link href={href({ o: x.number })} className="underline hover:text-ink">{p.openPage}</Link>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
            <BoardCursor label={t.stage.menabAi} />
          </BoardCanvas>
          <aside className="stage-side relative w-full md:w-[340px] shrink-0 md:min-h-0 flex flex-col">
            <PanelTabs
              storageKey={`menab-board-panel-${id}-${stage}`}
              initial={stage === 1 ? "chat" : "assistant"}
              tabs={[
                ...(stage === 1
                  ? [
                      {
                        key: "chat",
                        label: p.chat,
                        node: (
                          <div className="flex-1 min-h-[420px] md:min-h-0 flex">
                            <BriefChat
                              projectId={id}
                              canEdit={canEdit && !stageOneApproved}
                              cost={approx(estimateUsd(model, "briefTurn"))}
                              messages={(messages ?? []) as never}
                              copy={p}
                              models={modelOptions.map((m) => ({ id: m.id, name: m.name, price: m.price }))}
                              paths={t.stage.paths}
                              model={model}
                            />
                          </div>
                        ),
                      },
                    ]
                  : []),
                {
                  key: "assistant",
                  label: t.stage.assistant,
                  node: (
                    <section className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="mn-label">{p.model}</span>
                        <StepModelPicker projectId={id} label={p.model} options={modelOptions} value={model} defaultLabel={model === workspaceDefault ? p.defaultTag : ""} disabled={!canEdit} />
                      </div>
                      {stage === 1 && docsReady && editableHere && <ChangeBox projectId={id} copy={p.change} cost={approx(estimateUsd(model, "stageOne"))} mic={t.mic} />}
                    </section>
                  ),
                },
                {
                  key: "brief",
                  label: p.brief,
                  node: <BriefPanel brief={brief} p={p} missing={missing} projectId={id} editable={false} />,
                },
              ]}
            />
          </aside>
        </main>
      ) : (
        <main className="flex-1 min-h-0 px-4 md:px-6 pb-4 flex flex-col md:flex-row gap-4">
          {/* Steps of the stage */}
          <nav aria-label={t.stage.outputsLabel} className="stage-steps relative w-full md:w-[248px] shrink-0 md:min-h-0 md:overflow-y-auto self-start md:max-h-full bg-ground-deep border border-line rounded-lg p-3 flex flex-col gap-1">
            <span className="mn-label p-2">{fill(t.stage.outputsCount, { n: order.indexOf(showing) + 1, count: list.length })}</span>
            {list.map((x) => {
              const st = statusOf(x.number);
              const isOpen = (showing === 1 || showing === 2) && open === x.number;
              const inner = (
                <>
                  <span className={st === "waiting" ? "text-ink-muted" : ""}>{x.number === 1 ? p.chat : t.outputs[x.number]}</span>
                  <StatusChip status={st as OutputStatus} label={statusLabel(t, st)} />
                </>
              );
              const cls = `flex justify-between items-center gap-2 p-2.5 rounded-md text-[14px] ${isOpen ? "font-medium bg-surface border border-line" : "border border-transparent hover:bg-tint-2"}`;
              return showing === 1 || showing === 2 ? (
                <Link key={x.id} href={href({ o: x.number })} aria-current={isOpen ? "page" : undefined} className={cls}>{inner}</Link>
              ) : (
                <div key={x.id} className={cls}>{inner}</div>
              );
            })}
          </nav>

          {showing === 2 ? (
            <section className="relative flex-1 min-w-0 md:min-h-0 md:overflow-y-auto bg-surface border border-line rounded-lg">
              <div className="px-6 py-5 border-b border-line flex flex-wrap items-center gap-3">
                <div className="grow flex flex-col gap-1">
                  <span className="mn-label" lang="en">{String(open).padStart(2, "0")} · v{openOut?.current_version ?? 0}</span>
                  <h1 className="h2 m-0">{t.outputs[open]}</h1>
                </div>
                <Versions projectId={id} n={open} list={versionList ?? []} current={openOut?.current_version ?? 0} editable={editableHere} c={t.creative} />
                <StatusChip status={statusOf(open) as OutputStatus} label={statusLabel(t, statusOf(open))} />
              </div>
              <div className="p-6">
                {open === 8 ? (
                  <MeetingView
                    projectId={id}
                    directions={content[7] as never}
                    meeting={meeting}
                    editable={editableHere}
                    c={t.creative}
                    mic={t.mic}
                    run={runCopy}
                    cost={approx(estimateUsd(model, "creativeBuild"))}
                  />
                ) : open === 12 ? (
                  <CreativeApproval t={t} content={content} meeting={meeting} isReady={isReady} seconds={seconds} href={(n) => href({ o: n })} />
                ) : statusOf(open) === "generating" && !content[open] ? (
                  <MenabLoader size={20} label={p.writing} />
                ) : content[open] ? (
                  open === 7 ? (
                    <DirectionsView projectId={id} content={content[7] as never} chosen={meeting.chosen} editable={editableHere && statusOf(7) !== "generating"} c={t.creative} />
                  ) : open === 9 ? (
                    <ScriptView projectId={id} content={content[9] as never} seconds={seconds} editable={editableHere && statusOf(9) !== "generating"} c={t.creative} />
                  ) : open === 10 ? (
                    <TreatmentView projectId={id} content={content[10] as never} editable={editableHere && statusOf(10) !== "generating"} c={t.creative} />
                  ) : (
                    <MoodView projectId={id} content={content[11] as never} editable={editableHere && statusOf(11) !== "generating"} c={t.creative} />
                  )
                ) : editableHere && (open === 7 ? statusOf(7) === "failed" : open === 9 ? isReady(8) : Boolean(content[9])) ? (
                  <TryAgain
                    projectId={id}
                    n={open}
                    failed={statusOf(open) === "failed"}
                    cost={approx(estimateUsd(model, open === 7 ? "directions" : open === 9 && !content[10] ? "creativeBuild" : "revise"))}
                    run={runCopy}
                    c={t.creative.redo}
                  />
                ) : (
                  <p className="body text-ink-muted m-0">{open === 7 ? t.creative.footer.start : isReady(8) ? p.docs.notWritten : t.creative.footer.pick}</p>
                )}
              </div>
            </section>
          ) : showing !== 1 ? (
            <section className="flex-1 min-w-0 self-start bg-surface border border-line rounded-lg p-6">
              <span className="mn-label">{fill(t.projects.stageOf, { n: currentIndex + 1, total: order.length })}</span>
              <h1 className="h2 m-0 mt-1 mb-2">{names[currentIndex]}</h1>
              <p className="body text-ink-muted m-0">{fill(p.later, { m: MILESTONE[showing] ?? "" })}</p>
              <p className="small m-0 mt-4 flex gap-4">
                <Link href={href({ o: 3 })} className="underline">{t.outputs[3]}</Link>
                {stageTwo.length > 0 && <Link href={href({ o: 9 })} className="underline">{t.outputs[9]}</Link>}
              </p>
            </section>
          ) : open === 1 ? (
            <div className="flex-1 min-w-0 h-[75vh] md:h-auto md:min-h-0 flex">
              <BriefChat
                projectId={id}
                canEdit={editableHere}
                cost={approx(estimateUsd(model, "briefTurn"))}
                messages={(messages ?? []) as never}
                copy={p}
                models={modelOptions.map((m) => ({ id: m.id, name: m.name, price: m.price }))}
                paths={t.stage.paths}
                model={model}
              />
            </div>
          ) : (
            <section className="relative flex-1 min-w-0 md:min-h-0 md:overflow-y-auto bg-surface border border-line rounded-lg">
              <div className="px-6 py-5 border-b border-line flex items-center gap-3">
                <div className="grow flex flex-col gap-1">
                  <span className="mn-label" lang="en">{String(open).padStart(2, "0")} · v{outs.find((x) => x.number === open)?.current_version ?? 0}</span>
                  <h1 className="h2 m-0">{t.outputs[open]}</h1>
                </div>
                <Versions projectId={id} n={open} list={versionList ?? []} current={openOut?.current_version ?? 0} editable={editableHere} c={t.creative} />
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

          {/* Right panel: Brief and Assistant as two tabs; the brief first while talking. */}
          <aside className="stage-side relative w-full md:w-[320px] lg:w-[340px] shrink-0 md:min-h-0 flex flex-col">
            <PanelTabs
              storageKey={`menab-panel-${id}-${showing}-${open === 1 ? "chat" : "doc"}`}
              initial={showing === 1 && open === 1 ? "brief" : "assistant"}
              tabs={[
                {
                  key: "brief",
                  label: p.brief,
                  node: (
                    <>
                      <BriefPanel brief={brief} p={p} missing={missing} projectId={id} editable={editableHere && showing === 1} />
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
                          disabled={!editableHere || showing !== 1}
                          options={[
                            { path: "ai", label: p.useAi },
                            { path: "production", label: p.useProduction },
                            { path: "hybrid", label: p.useHybrid },
                          ]}
                        />
                      </section>
                    </>
                  ),
                },
                {
                  key: "assistant",
                  label: t.stage.assistant,
                  node: (
                    <section className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
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
                      {showing === 2 && editableHere && [7, 9, 10, 11].includes(open) && Boolean(content[open]) && (
                        <CreativeAssistant
                          key={open}
                          projectId={id}
                          n={open}
                          copy={p.change}
                          cost={approx(estimateUsd(model, open === 7 ? "directions" : "revise"))}
                          mic={t.mic}
                          run={runCopy}
                        />
                      )}
                      {showing === 1 && open !== 1 && docsReady && editableHere && (
                        <>
                          <ChangeBox projectId={id} copy={p.change} cost={approx(estimateUsd(model, "stageOne"))} mic={t.mic} />
                          <RewriteButton projectId={id} label={p.rewrite} cost={approx(estimateUsd(model, "stageOne"))} />
                        </>
                      )}
                    </section>
                  ),
                },
              ]}
            />
          </aside>
        </main>
      )}

      <AutoRefresh active={generating} />
      {showing < stage && (
        <footer className="shrink-0 sticky bottom-0 bg-surface border-t border-line px-5 py-3 flex flex-wrap gap-3 items-center z-10">
          <span className="small text-ink-muted grow">{fill(t.stage.viewingApproved, { name: names[order.indexOf(showing)] ?? "" })}</span>
          <Link href={href({})} className="mn-btn mn-btn--primary">{fill(t.stage.goTo, { name: names[currentIndex] ?? "" })}</Link>
        </footer>
      )}
      {canEdit && showing === 2 && stage === 2 && !stageTwoApproved && !content[7] && statusOf(7) !== "generating" && (
        <CreativeStart projectId={id} label={t.creative.writeDirections} cost={approx(estimateUsd(model, "directions"))} message={t.creative.footer.start} run={runCopy} />
      )}
      {canEdit && showing === 2 && stage === 2 && (stageTwoApproved || content[7] || statusOf(7) === "generating") && (
        <StageFooter
          projectId={id}
          stage={2}
          message={
            stageTwoApproved
              ? t.creative.footer.approved
              : [7, 9, 10, 11].some((n) => statusOf(n) === "generating")
                ? t.creative.footer.writing
                : !isReady(8)
                  ? t.creative.footer.pick
                  : t.creative.footer.review
          }
          action={!stageTwoApproved && isReady(12) && stage === 2 ? "approve" : null}
          label={fill(t.stage.approve, { n: 2 })}
        />
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

// What a waiting card is waiting for.
function startsWhen(n: number, t: Dictionary): string {
  const w = t.stage.startsWhen;
  if (n === 1) return w.talk;
  if (n >= 3 && n <= 6) return w.brief;
  if (n === 7) return w.ask;
  if (n === 8) return w.choose;
  if (n === 9) return w.direction;
  if (n === 10 || n === 11) return w.script;
  if (n === 12) return w.all;
  return "";
}

// A one-line summary of a Creative output for its board card.
function creativeExcerpt(n: number, content: Record<number, unknown>, meeting: { chosen?: number; notes?: string }, t: Dictionary): string {
  const dirs = (content[7] as { directions?: { title: string; idea: string }[] } | undefined)?.directions ?? [];
  if (n === 7) return dirs.map((d, i) => `${String.fromCharCode(65 + i)}. ${d.title}`).join(" · ");
  if (n === 8) return meeting.chosen !== undefined && dirs[meeting.chosen] ? `${t.creative.chosen}: ${dirs[meeting.chosen].title}` : t.creative.footer.pick;
  if (n === 9) return (content[9] as { rows?: { vo_ar?: string; picture?: string }[] } | undefined)?.rows?.find((r) => r.vo_ar)?.vo_ar ?? "";
  if (n === 10) return (content[10] as { idea?: string } | undefined)?.idea ?? "";
  if (n === 11) return (content[11] as { look?: string } | undefined)?.look ?? "";
  if (n === 12) return content[12] ? t.creative.approval.ready : "";
  return "";
}

// Output 12: everything the client signs off in the Creative stage, in one place.
function CreativeApproval({ t, content, meeting, isReady, seconds, href }: { t: Dictionary; content: Record<number, unknown>; meeting: { chosen?: number; notes?: string }; isReady: (n: number) => boolean; seconds: number; href: (n: number) => string }) {
  const c = t.creative;
  const dirs = (content[7] as { directions?: { title: string; idea: string }[] } | undefined)?.directions ?? [];
  const chosen = meeting.chosen !== undefined ? dirs[meeting.chosen] : undefined;
  const items = [7, 8, 9, 10, 11];
  const waiting = items.filter((n) => !isReady(n));
  const script = content[9] as { rows?: { seconds: number }[] } | undefined;
  const total = (script?.rows ?? []).reduce((n, r) => n + (Number(r.seconds) || 0), 0);
  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      <p className="small text-ink-muted m-0">{c.approval.intro}</p>
      <p className={`small m-0 px-3 py-2 rounded-md ${waiting.length ? "bg-tint-2" : "border border-line"}`}>
        {waiting.length ? fill(c.approval.waiting, { items: waiting.map((n) => t.outputs[n]).join(", ") }) : c.approval.ready}
      </p>
      {chosen && (
        <div>
          <span className="mn-label">{c.approval.direction}</span>
          <h2 className="h3 m-0 mt-1" dir="auto">{chosen.title}</h2>
          <p className="body m-0 mt-1" dir="auto">{chosen.idea}</p>
        </div>
      )}
      {script?.rows && (
        <p className="small m-0">
          <span className="mn-label me-2">{c.approval.length}</span>
          <span className="data">{fill(c.script.total, { n: total, target: seconds })}</span>
        </p>
      )}
      <ul className="m-0 p-0 list-none flex flex-col border border-line rounded-lg">
        {items.map((n, i) => (
          <li key={n} className={`flex items-center gap-3 px-4 py-3 ${i ? "border-t border-line" : ""}`}>
            <span className="mn-label" lang="en">{String(n).padStart(2, "0")}</span>
            <span className="body grow">{t.outputs[n]}</span>
            <span className={`mn-chip ${isReady(n) ? "mn-chip--ready" : "mn-chip--waiting"}`}>{isReady(n) ? t.status.ready : t.status.waiting}</span>
            <Link href={href(n)} className="small underline">{c.approval.open}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
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
