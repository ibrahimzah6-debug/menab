import "server-only";
import type { BriefFields } from "@/lib/ai/brain";
import { backupFor, StoppedError, type Step } from "@/lib/ai/brain-core";
import { textModel } from "@/lib/ai/catalog";
import { fitScript, writeDirections, writeMood, writeScript, writeTreatment, type Directions, type Script } from "@/lib/ai/creative";
import { isFailing } from "@/lib/ai/health";
import { loadProject, noticeFallback } from "@/lib/brief-turn";
import { activeRules } from "@/lib/dev";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, notify, saveVersion } from "@/lib/projects";

// Runs the Creative stage's AI work and reports each step as it happens (one JSON per line).
//  directions: writes output 7 (three directions).
//  build: after a direction is chosen (output 8), writes the script (9), then the treatment (10)
//         and visual mood (11) side by side, then marks the approval package (12) ready.
//  revise: rewrites one output (7, 9, 10 or 11) with the producer's instruction.
// Every save is a new version; the earlier ones stay and can be restored.

export type CreativeEvent =
  | { t: "call"; model: string }
  | { t: "retry"; model: string }
  | { t: "switch"; from: string; to: string }
  | { t: "skip"; from: string; to: string }
  | { t: "writing"; n: number }
  | { t: "saved"; n: number }
  | { t: "done" }
  | { t: "error"; message: string };

type Out = { id: string; workspace_id: string; number: number; status: string; current_version: number };

export async function runCreative(
  projectId: string,
  action: { kind: "directions" } | { kind: "build" } | { kind: "revise"; n: number; instruction: string },
  emit: (e: CreativeEvent) => void,
  signal?: AbortSignal,
) {
  const { me, supabase, project, model: picked } = await loadProject(projectId);
  const { t, locale } = await getI18n();
  if (project.current_stage !== 2) throw new Error(t.project.notCurrentStage);

  let model = picked;
  if (await isFailing(model)) {
    const backup = textModel(backupFor(textModel(model))).id;
    emit({ t: "skip", from: textModel(model).name, to: textModel(backup).name });
    model = backup;
  }

  const { data: outs } = await supabase.from("outputs").select("id, workspace_id, number, status, current_version").eq("project_id", projectId).in("number", [3, 4, 5, 7, 8, 9, 10, 11, 12]);
  const out = (n: number) => (outs ?? []).find((o) => o.number === n) as Out | undefined;
  const ids = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = ids.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", ids.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = out(n);
    return o ? versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content : undefined;
  };

  const brief = (project.brief ?? {}) as Partial<BriefFields>;
  const language = brief.language?.toLowerCase().includes("arab") || locale === "ar" ? "Arabic (Saudi dialect for VO and dialogue), with English beside it" : "English, with the VO and dialogue also in Saudi dialect Arabic";
  const { data: ws } = await supabase.from("workspaces").select("memory_on").eq("id", project.workspace_id).maybeSingle();
  const memory = ws?.memory_on === false ? [] : ((await supabase.from("memories").select("content").eq("workspace_id", project.workspace_id).order("created_at", { ascending: false }).limit(40)).data ?? []).map((r) => r.content as string);
  const onStep = (s: Step) => {
    if (signal?.aborted) return;
    if (s.kind === "calling") emit({ t: "call", model: s.model });
    else if (s.kind === "retrying") emit({ t: "retry", model: s.model });
    else emit({ t: "switch", from: s.from, to: s.to });
  };
  const ctx = {
    brief,
    stageOne: { summary: content(3), strategy: content(4), pathway: content(5) },
    path: project.path ?? project.path_suggested,
    language,
    modelId: model,
    memory,
    rules: await activeRules(),
    onStep,
    signal,
  };

  // One AI piece: mark it as being written, run it, save it as a new version, log the cost.
  const piece = async <T>(n: number, task: string, run: () => Promise<{ data: T; usage: { inputTokens: number; outputTokens: number; costUsd: number; seconds: number }; model: string; fallbackFrom?: string; firstError?: string }>, shape?: (d: T) => unknown) => {
    const o = out(n);
    if (!o) throw new Error("Step not found.");
    const before = o.status;
    emit({ t: "writing", n });
    await supabase.from("outputs").update({ status: "generating" }).eq("id", o.id);
    try {
      const r = await run();
      if (signal?.aborted) throw new StoppedError();
      await saveVersion(supabase, o, shape ? shape(r.data) : r.data, "ai", me.userId, r.model);
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task, provider: textModel(r.model).provider, model: r.model, ok: true, usage: r.usage, fallbackFrom: r.fallbackFrom });
      if (r.fallbackFrom) await noticeFallback(me.workspace.id, projectId, r.fallbackFrom, r.model, r.firstError);
      emit({ t: "saved", n });
      return r.data;
    } catch (e) {
      // Keep the earlier version if there is one; a step that never had one is marked failed.
      await supabase.from("outputs").update({ status: o.current_version > 0 ? (before === "generating" ? "ready" : before) : "failed" }).eq("id", o.id);
      if (!(e instanceof StoppedError) && !signal?.aborted) {
        const msg = e instanceof Error ? e.message : String(e);
        await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task, provider: textModel(model).provider, model, ok: false, error: msg });
        await notify({ workspaceId: me.workspace.id, projectId, kind: "ai_failed", title: `${textModel(model).name} and its backup could not write ${t.outputs[n]}`, body: msg });
        throw new Error(t.project.aiFailed);
      }
      throw e;
    }
  };

  const meeting = (content(8) ?? {}) as { chosen?: number; notes?: string };
  const directions = content(7) as Directions | undefined;
  const direction = directions?.directions?.[meeting.chosen ?? -1];
  const seconds = Number(brief.length_seconds) || 30;

  if (action.kind === "directions") {
    await piece(7, "creative-directions", () => writeDirections(ctx));
    return;
  }

  if (action.kind === "build") {
    if (!direction) throw new Error(t.creative.pickFirst);
    const extra = { direction, notes: meeting.notes ?? "" };
    await supabase.from("outputs").update({ status: "generating" }).eq("project_id", projectId).in("number", [9, 10, 11]);
    const script = await piece(9, "creative-script", () => writeScript({ ...ctx, ...extra, seconds }), (d: Script) => fitScript(d, seconds));
    const fitted = fitScript(script as Script, seconds);
    // The treatment and the visual mood are written side by side while the script is read.
    const results = await Promise.allSettled([
      piece(10, "creative-treatment", () => writeTreatment({ ...ctx, ...extra, script: fitted })),
      piece(11, "creative-mood", () => writeMood({ ...ctx, ...extra, script: fitted })),
    ]);
    await markPackage();
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (failed) throw failed.reason;
    return;
  }

  // Revise one output with an instruction.
  const n = action.n;
  const current = content(n);
  if (!current) throw new Error(t.project.docs.notWritten);
  if (n === 7) await piece(7, "creative-directions", () => writeDirections(ctx, action.instruction, current));
  else if (!direction) throw new Error(t.creative.pickFirst);
  else if (n === 9) await piece(9, "creative-script", () => writeScript({ ...ctx, direction, notes: meeting.notes ?? "", seconds }, action.instruction, current), (d: Script) => fitScript(d, seconds));
  else if (n === 10) await piece(10, "creative-treatment", () => writeTreatment({ ...ctx, direction, notes: meeting.notes ?? "", script: content(9) }, action.instruction, current));
  else if (n === 11) await piece(11, "creative-mood", () => writeMood({ ...ctx, direction, notes: meeting.notes ?? "", script: content(9) }, action.instruction, current));
  else throw new Error("This step can't be rewritten here.");
  await markPackage();

  // Output 12, the approval package, is ready once the script, treatment and mood are.
  async function markPackage() {
    const { data: now } = await supabase.from("outputs").select("number, status").eq("project_id", projectId).in("number", [7, 8, 9, 10, 11]);
    const ready = (now ?? []).every((o) => ["ready", "edited", "approved"].includes(o.status));
    const o12 = out(12);
    if (!o12) return;
    if (ready) {
      await saveVersion(supabase, o12, { direction: direction?.title ?? null, seconds, packaged: [7, 8, 9, 10, 11] }, "ai", me.userId, null);
      emit({ t: "saved", n: 12 });
    } else {
      await supabase.from("outputs").update({ status: "waiting" }).eq("id", o12.id);
    }
  }
}
