import "server-only";
import { backupFor, StoppedError, type Step } from "@/lib/ai/brain-core";
import { textModel } from "@/lib/ai/catalog";
import { isFailing } from "@/lib/ai/health";
import { Budget, CrewPermits, fixBudget, Schedule, writeBudget, writeCrewPermits, writeSchedule } from "@/lib/ai/preprod";
import { loadProject, noticeFallback } from "@/lib/brief-turn";
import type { CreativeEvent } from "@/lib/creative-run";
import { activeRules } from "@/lib/dev";
import { getI18n } from "@/lib/i18n/server";
import { claimForWriting, logAiJob, notify, saveVersion } from "@/lib/projects";

// Stage 4, Pre-production: writes outputs 20, 22, 25, 26, 31, 32 and assembles 27.
//  write:  budget with equipment, crew needs with permits, schedule with call sheets, side by side.
//  redo:   one pair again from scratch.  revise: the same, with the producer's instruction.
// The crew members a producer picked for the project (22) are always kept.

type Out = { id: string; workspace_id: string; number: number; status: string; current_version: number };
type Usage = { inputTokens: number; outputTokens: number; costUsd: number; seconds: number };
type AiResult<T> = { data: T; usage: Usage; model: string; fallbackFrom?: string; firstError?: string };

const GROUP: Record<number, "budget" | "crew" | "schedule"> = { 20: "budget", 26: "budget", 22: "crew", 25: "crew", 31: "schedule", 32: "schedule" };
const OUTPUTS = { budget: [20, 26], crew: [22, 25], schedule: [31, 32] } as const;

export async function runPreprod(
  projectId: string,
  action: { kind: "write" } | { kind: "redo"; n: number } | { kind: "revise"; n: number; instruction: string },
  emit: (e: CreativeEvent) => void,
  signal?: AbortSignal,
) {
  const { me, supabase, project, model: picked } = await loadProject(projectId);
  const { t, locale } = await getI18n();
  if (project.current_stage !== 4) throw new Error(t.project.notCurrentStage);

  let model = picked;
  if (await isFailing(model)) {
    const backup = textModel(backupFor(textModel(model))).id;
    emit({ t: "skip", from: textModel(model).name, to: textModel(backup).name });
    model = backup;
  }

  const numbers = [6, 9, 13, 14, 15, 16, 18, 20, 22, 25, 26, 27, 31, 32];
  const { data: outs } = await supabase.from("outputs").select("id, workspace_id, number, status, current_version").eq("project_id", projectId).in("number", numbers);
  const out = (n: number) => (outs ?? []).find((o) => o.number === n) as Out | undefined;
  const withV = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = withV.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", withV.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = out(n);
    return o ? versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content : undefined;
  };

  const brief = (project.brief ?? {}) as Record<string, unknown>;
  const { data: ws } = await supabase.from("workspaces").select("memory_on").eq("id", project.workspace_id).maybeSingle();
  const memory = ws?.memory_on === false ? [] : ((await supabase.from("memories").select("content").eq("workspace_id", project.workspace_id).order("created_at", { ascending: false }).limit(40)).data ?? []).map((r) => r.content as string);
  const onStep = (s: Step) => {
    if (signal?.aborted) return;
    if (s.kind === "calling") emit({ t: "call", model: s.model });
    else if (s.kind === "retrying") emit({ t: "retry", model: s.model });
    else {
      console.warn(`[preprod] switching from ${s.from} to ${s.to}: ${s.reason ?? ""}`);
      emit({ t: "switch", from: s.from, to: s.to });
    }
  };
  const ctx = {
    brief,
    path: project.path ?? project.path_suggested,
    language: locale === "ar" ? "Arabic (Saudi), with English names for equipment and crew roles where usual" : "English",
    modelId: model,
    plan: { cps: content(6), script: content(9), characters: content(13), wardrobe: content(14), locations: content(15), art: content(16), shots: content(18) },
    memory,
    rules: await activeRules(),
    onStep,
    signal,
  };

  const pair = async <T>(group: keyof typeof OUTPUTS, task: string, run: () => Promise<AiResult<T>>, split: (d: T) => [unknown, unknown]) => {
    const [a, b] = OUTPUTS[group];
    const oa = out(a);
    const ob = out(b);
    if (!oa || !ob) throw new Error("Step not found.");
    if (!(await claimForWriting(supabase, projectId, [a, b]))) throw new Error(t.project.alreadyWriting);
    emit({ t: "writing", n: a });
    try {
      const r = await run();
      if (signal?.aborted) throw new StoppedError();
      const [ca, cb] = split(r.data);
      await saveVersion(supabase, oa, ca, "ai", me.userId, r.model);
      emit({ t: "saved", n: a });
      await saveVersion(supabase, ob, cb, "ai", me.userId, r.model);
      emit({ t: "saved", n: b });
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task, provider: textModel(r.model).provider, model: r.model, ok: true, usage: r.usage, fallbackFrom: r.fallbackFrom });
      if (r.fallbackFrom) {
        await noticeFallback(me.workspace.id, projectId, r.fallbackFrom, r.model, r.firstError);
        ctx.modelId = r.model;
      }
      return r.data;
    } catch (e) {
      for (const o of [oa, ob]) await supabase.from("outputs").update({ status: o.current_version > 0 ? "ready" : "failed" }).eq("id", o.id);
      if (!(e instanceof StoppedError) && !signal?.aborted) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[preprod] ${task} failed on ${model}: ${msg}`);
        await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task, provider: textModel(model).provider, model, ok: false, error: msg });
        await notify({ workspaceId: me.workspace.id, projectId, kind: "ai_failed", title: `${textModel(model).name} and its backup could not write ${t.outputs[a]}`, body: msg });
        throw new Error(t.project.aiFailed);
      }
      throw e;
    }
  };

  const members = ((content(22) as { members?: unknown[] } | undefined)?.members ?? []) as unknown[];
  const cur = (a: number, b: number) => ({ ...(content(a) as object), ...(content(b) as object) });
  const doBudget = (instruction?: string) =>
    pair<Budget>("budget", "preprod-budget", async () => {
      const r = await writeBudget(ctx, instruction, instruction ? cur(20, 26) : undefined);
      return { ...r, data: fixBudget(r.data) };
    }, (d) => [{ budget: d.budget }, { equipment: d.equipment }]);
  const doCrew = (instruction?: string) =>
    pair<CrewPermits>("crew", "preprod-crew", () => writeCrewPermits(ctx, instruction, instruction ? cur(22, 25) : undefined), (d) => [{ needs: d.crew_needs, members }, { permits: d.permits }]);
  const doSchedule = (instruction?: string) =>
    pair<Schedule>("schedule", "preprod-schedule", () => writeSchedule(ctx, instruction, instruction ? cur(31, 32) : undefined), (d) => [{ schedule: d.schedule }, { call_sheets: d.call_sheets }]);

  // The PPM booklet is assembled from what exists; it is "written" once the other pieces are.
  const assemble = async () => {
    const o = out(27);
    if (o && o.current_version === 0) await saveVersion(supabase, o, { assembled: true }, "ai", me.userId, null);
  };

  if (action.kind === "write") {
    const results = await Promise.allSettled([doBudget(), doCrew(), doSchedule()]);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    if (results.some((r) => r.status === "fulfilled")) await assemble();
    if (failed) throw failed.reason;
    return;
  }
  const group = GROUP[action.n];
  if (!group) throw new Error("This step can't be written here.");
  const instruction = action.kind === "revise" ? action.instruction : undefined;
  if (group === "budget") await doBudget(instruction);
  else if (group === "crew") await doCrew(instruction);
  else await doSchedule(instruction);
  await assemble();
}
