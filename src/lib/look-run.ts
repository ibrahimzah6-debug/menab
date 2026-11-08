import "server-only";
import type { BriefFields } from "@/lib/ai/brain";
import { backupFor, StoppedError, type Step } from "@/lib/ai/brain-core";
import { textModel } from "@/lib/ai/catalog";
import { isFailing } from "@/lib/ai/health";
import { fitShots, writeCast, writePlaces, writeShots, type Cast, type Places, type Shots } from "@/lib/ai/look";
import { loadProject, noticeFallback } from "@/lib/brief-turn";
import type { CreativeEvent } from "@/lib/creative-run";
import { activeRules } from "@/lib/dev";
import { getI18n } from "@/lib/i18n/server";
import { claimForWriting, logAiJob, notify, saveVersion } from "@/lib/projects";

// Stage 3, Look and characters: writes outputs 13 to 18 and reports each step.
//  write:  characters with wardrobe (13, 14) and locations with art (15, 16) side by side,
//          then the shot list (18) and the storyboard frames' text (17).
//  redo:   writes one pair again from scratch (13 or 14, 15 or 16, 17 or 18).
//  revise: the same, with the producer's instruction.
// The storyboard images themselves are drawn separately (frames.ts), with their own price.

type Out = { id: string; workspace_id: string; number: number; status: string; current_version: number };
type Usage = { inputTokens: number; outputTokens: number; costUsd: number; seconds: number };
type AiResult<T> = { data: T; usage: Usage; model: string; fallbackFrom?: string; firstError?: string };

// Which call writes which outputs.
const GROUP: Record<number, "cast" | "places" | "shots"> = { 13: "cast", 14: "cast", 15: "places", 16: "places", 17: "shots", 18: "shots" };
const OUTPUTS = { cast: [13, 14], places: [15, 16], shots: [18, 17] } as const;

export async function runLook(
  projectId: string,
  action: { kind: "write" } | { kind: "redo"; n: number } | { kind: "revise"; n: number; instruction: string },
  emit: (e: CreativeEvent) => void,
  signal?: AbortSignal,
) {
  const { me, supabase, project, model: picked } = await loadProject(projectId);
  const { t, locale } = await getI18n();
  if (project.current_stage !== 3) throw new Error(t.project.notCurrentStage);

  let model = picked;
  if (await isFailing(model)) {
    const backup = textModel(backupFor(textModel(model))).id;
    emit({ t: "skip", from: textModel(model).name, to: textModel(backup).name });
    model = backup;
  }

  const numbers = [3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18];
  const { data: outs } = await supabase.from("outputs").select("id, workspace_id, number, status, current_version").eq("project_id", projectId).in("number", numbers);
  const out = (n: number) => (outs ?? []).find((o) => o.number === n) as Out | undefined;
  const withV = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = withV.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", withV.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = out(n);
    return o ? versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content : undefined;
  };

  const brief = (project.brief ?? {}) as Partial<BriefFields>;
  const seconds = Number(brief.length_seconds) || 30;
  const language = brief.language?.toLowerCase().includes("arab") || locale === "ar" ? "Arabic (Saudi), with English names for shot sizes and camera terms" : "English";
  const directions = (content(7) as { directions?: unknown[] } | undefined)?.directions ?? [];
  const meeting = (content(8) ?? {}) as { chosen?: number; notes?: string };
  const [{ data: ws }, { data: libChars }, { data: libPlaces }] = await Promise.all([
    supabase.from("workspaces").select("memory_on").eq("id", project.workspace_id).maybeSingle(),
    supabase.from("characters").select("id, name, description, age, look, wardrobe").eq("workspace_id", project.workspace_id).limit(30),
    supabase.from("locations").select("id, name, description, city, kind").eq("workspace_id", project.workspace_id).limit(30),
  ]);
  const memory = ws?.memory_on === false ? [] : ((await supabase.from("memories").select("content").eq("workspace_id", project.workspace_id).order("created_at", { ascending: false }).limit(40)).data ?? []).map((r) => r.content as string);
  const onStep = (s: Step) => {
    if (signal?.aborted) return;
    if (s.kind === "calling") emit({ t: "call", model: s.model });
    else if (s.kind === "retrying") emit({ t: "retry", model: s.model });
    else {
      console.warn(`[look] switching from ${s.from} to ${s.to}: ${s.reason ?? ""}`);
      emit({ t: "switch", from: s.from, to: s.to });
    }
  };
  const ctx = {
    brief,
    creative: {
      direction: meeting.chosen !== undefined ? directions[meeting.chosen] : undefined,
      notes: meeting.notes ?? "",
      script: content(9),
      treatment: content(10),
      mood: content(11),
    },
    path: project.path ?? project.path_suggested,
    language,
    modelId: model,
    library: { characters: libChars ?? [], locations: libPlaces ?? [] },
    memory,
    rules: await activeRules(),
    onStep,
    signal,
  };

  // One call that writes two outputs: mark both as being written, save both, log the cost.
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
        console.error(`[look] ${task} failed on ${model}: ${msg}`);
        await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task, provider: textModel(model).provider, model, ok: false, error: msg });
        await notify({ workspaceId: me.workspace.id, projectId, kind: "ai_failed", title: `${textModel(model).name} and its backup could not write ${t.outputs[a]}`, body: msg });
        throw new Error(t.project.aiFailed);
      }
      throw e;
    }
  };

  const doCast = (instruction?: string) =>
    pair<Cast>("cast", "look-cast", () => writeCast(ctx, instruction, instruction ? { ...(content(13) as object), ...(content(14) as object) } : undefined), (d) => [{ characters: d.characters }, { wardrobe: d.wardrobe }]);
  const doPlaces = (instruction?: string) =>
    pair<Places>("places", "look-places", () => writePlaces(ctx, instruction, instruction ? { ...(content(15) as object), ...(content(16) as object) } : undefined), (d) => [{ locations: d.locations }, { art: d.art }]);
  const doShots = (cast: unknown, places: unknown, instruction?: string) =>
    pair<Shots>(
      "shots",
      "look-shots",
      async () => {
        const r = await writeShots({ ...ctx, cast, places, seconds }, instruction, instruction ? content(18) : undefined);
        return { ...r, data: fitShots(r.data, seconds) };
      },
      (d) => [
        { shots: d.shots.map(({ image_prompt: _p, ...rest }) => { void _p; return rest; }) },
        { frames: d.shots.map((x) => ({ n: x.n, scene: x.scene, size: x.size, angle: x.angle, movement: x.movement, lens: x.lens, action: x.action, dialogue: x.dialogue, seconds: x.seconds, cast: x.cast, set: x.set, prompt: x.image_prompt })) },
      ],
    );

  if (action.kind === "write") {
    const [cast, places] = await Promise.allSettled([doCast(), doPlaces()]);
    if (cast.status === "rejected") throw cast.reason;
    if (places.status === "rejected") throw places.reason;
    await doShots(cast.value, places.value);
    return;
  }

  const group = GROUP[action.n];
  if (!group) throw new Error("This step can't be written here.");
  const instruction = action.kind === "revise" ? action.instruction : undefined;
  if (group === "cast") await doCast(instruction);
  else if (group === "places") await doPlaces(instruction);
  else {
    const cast = { ...(content(13) as object), ...(content(14) as object) };
    const places = { ...(content(15) as object), ...(content(16) as object) };
    if (!content(13) || !content(15)) throw new Error(t.project.docs.notWritten);
    await doShots(cast, places, instruction);
  }
}
