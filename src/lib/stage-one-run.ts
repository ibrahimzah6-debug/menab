import "server-only";
import { missingRequired, writeStageOne, type BriefFields } from "@/lib/ai/brain";
import { backupFor, StoppedError, type Step } from "@/lib/ai/brain-core";
import { textModel } from "@/lib/ai/catalog";
import { isFailing } from "@/lib/ai/health";
import { loadProject, noticeFallback } from "@/lib/brief-turn";
import { activeRules } from "@/lib/dev";
import { getI18n } from "@/lib/i18n/server";
import { claimForWriting, logAiJob, saveVersion } from "@/lib/projects";

// Writes (or revises) the stage 1 documents, outputs 3 to 6, and reports each step as it
// happens, the same way as the brief chat and the Creative stage.
export type DocsEvent =
  | { t: "call"; model: string }
  | { t: "retry"; model: string }
  | { t: "switch"; from: string; to: string }
  | { t: "skip"; from: string; to: string }
  | { t: "writingDocs" }
  | { t: "saved"; n: number }
  | { t: "done" }
  | { t: "error"; message: string };

export async function runStageOne(projectId: string, instruction: string | undefined, emit: (e: DocsEvent) => void, signal?: AbortSignal) {
  const { t, locale } = await getI18n();
  const loaded = await loadProject(projectId);
  const { me, supabase, project } = loaded;
  if (project.current_stage !== 1) throw new Error(t.project.notCurrentStage);
  let model = loaded.model;
  // A model that keeps failing right now is skipped for its backup.
  if (await isFailing(model)) {
    const backup = textModel(backupFor(textModel(model))).id;
    emit({ t: "skip", from: textModel(model).name, to: textModel(backup).name });
    model = backup;
  }
  const brief = project.brief as BriefFields;
  if (missingRequired(brief).length) throw new Error(t.project.answerFirst);

  const { data: outs } = await supabase.from("outputs").select("id, workspace_id, number, current_version").eq("project_id", projectId).in("number", [3, 4, 5, 6]);
  if (!(await claimForWriting(supabase, projectId, [3, 4, 5, 6]))) throw new Error(t.project.alreadyWriting);
  emit({ t: "writingDocs" });

  const onStep = (s: Step) => {
    if (signal?.aborted) return;
    if (s.kind === "calling") emit({ t: "call", model: s.model });
    else if (s.kind === "retrying") emit({ t: "retry", model: s.model });
    else emit({ t: "switch", from: s.from, to: s.to });
  };

  let result;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const language = brief.language?.toLowerCase().includes("arab") || locale === "ar" ? "Arabic (Saudi), with names of deliverables in English where usual" : "English";
    // A rewrite with an instruction revises the current documents instead of starting over.
    let revise: { instruction: string; current: unknown } | undefined;
    const clean = instruction?.trim().slice(0, 2000);
    if (clean) {
      const current: Record<number, unknown> = {};
      for (const o of outs ?? []) {
        if (o.current_version < 1) continue;
        const { data: v } = await supabase.from("versions").select("content").eq("output_id", o.id).eq("version", o.current_version).maybeSingle();
        current[o.number] = v?.content;
      }
      revise = { instruction: clean, current: { summary: current[3], strategy: current[4], pathway: current[5], cps_and_kickoff: current[6] } };
    }
    // Workspace memory (Settings, Memory), unless it is turned off.
    const { data: ws } = await supabase.from("workspaces").select("memory_on").eq("id", project.workspace_id).maybeSingle();
    const memory = ws?.memory_on === false
      ? []
      : ((await supabase.from("memories").select("content").eq("workspace_id", project.workspace_id).order("created_at", { ascending: false }).limit(40)).data ?? []).map((r) => r.content as string);
    result = await writeStageOne(brief, project.path ?? project.path_suggested, today, language, model, revise, onStep, memory, await activeRules(), signal);
    if (signal?.aborted) throw new StoppedError();
  } catch (e) {
    const stopped = signal?.aborted || e instanceof StoppedError;
    if (!stopped) await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "stage1-docs", provider: textModel(model).provider, model, ok: false, error: e instanceof Error ? e.message : String(e) });
    // Keep earlier versions; only steps that never had one are marked failed.
    for (const o of outs ?? []) await supabase.from("outputs").update({ status: o.current_version > 0 ? "ready" : "failed" }).eq("id", o.id);
    throw stopped ? new StoppedError() : new Error(t.project.aiFailed);
  }
  const { docs, usage } = result;
  await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "stage1-docs", provider: textModel(result.model).provider, model: result.model, ok: true, usage, fallbackFrom: result.fallbackFrom });
  if (result.fallbackFrom) await noticeFallback(me.workspace.id, projectId, result.fallbackFrom, result.model, result.firstError);
  const content: Record<number, unknown> = { 3: docs.summary, 4: docs.strategy, 5: docs.pathway, 6: { cps: docs.cps, kickoff_notes: docs.kickoff_notes } };
  for (const o of [...(outs ?? [])].sort((a, b) => a.number - b.number)) {
    await saveVersion(supabase, o, content[o.number], "ai", me.userId, result.model);
    emit({ t: "saved", n: o.number });
  }
  if (!project.path) await supabase.from("projects").update({ path: docs.pathway.path }).eq("id", projectId);
}
