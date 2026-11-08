import "server-only";
import { ASPECTS, STYLE_PROMPT, imageBackup, imageModel, imageRequest, type Aspect, type Style } from "@/lib/ai/images";
import { createTask, getTask, KIE_USD_PER_CREDIT, KieError } from "@/lib/ai/kie";
import { loadProject } from "@/lib/brief-turn";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, notify } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";

// Draws storyboard frames (output 17) on Kie.ai, three at a time. Each frame: start the job,
// wait for it, copy the image to our own storage, then record its real cost. A failed job is
// tried once more, then on the backup model. A frame that still fails costs nothing.

export type FrameEvent =
  | { t: "drawing"; n: number; total: number; model: string }
  | { t: "drawn"; n: number }
  | { t: "drawBackup"; n: number; from: string; to: string }
  | { t: "drawFailed"; n: number; reason: string };

type Frame = { n: number; prompt: string; cast?: string[]; set?: string };
type Drawn = { url: string; credits: number; seconds: number; model: string; taskId: string };

const POLL_MS = 2500;
const FRAME_LIMIT_MS = 130_000;
const RUN_LIMIT_MS = 250_000;
const AT_ONCE = 3;
// Kie answers these when the account itself has a problem: stop the whole run.
const ACCOUNT = new Set([401, 402, 433]);

class AccountError extends Error {}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });

async function drawOnce(modelId: string, prompt: string, aspect: Aspect, refs: string[], signal?: AbortSignal): Promise<Drawn> {
  const req = imageRequest(modelId, prompt, aspect, refs);
  if (!req) throw new Error("This model needs a reference photo.");
  let taskId: string;
  try {
    taskId = await createTask(req.kieModel, req.input);
  } catch (e) {
    if (e instanceof KieError && ACCOUNT.has(e.code)) throw new AccountError(e.message);
    throw e;
  }
  const started = Date.now();
  while (Date.now() - started < FRAME_LIMIT_MS) {
    await wait(POLL_MS, signal);
    if (signal?.aborted) throw new Error("Stopped");
    const task = await getTask(taskId).catch(() => null);
    if (!task) continue;
    if (task.state === "success" && task.resultUrls[0]) {
      return { url: task.resultUrls[0], credits: task.credits ?? 0, seconds: task.seconds ?? (Date.now() - started) / 1000, model: modelId, taskId };
    }
    if (task.state === "fail") throw new Error(task.failMsg || "The model could not draw this frame.");
  }
  throw new Error("The model took too long.");
}

export async function runFrames(
  projectId: string,
  req: { frames: number[]; style: Style; model: string; aspect: Aspect },
  emit: (e: FrameEvent) => void,
  signal?: AbortSignal,
) {
  const { me, supabase, project } = await loadProject(projectId);
  const { t } = await getI18n();
  if (project.current_stage !== 3) throw new Error(t.project.notCurrentStage);
  const style: Style = req.style === "photo" ? "photo" : "sketch";
  const aspect: Aspect = ASPECTS.includes(req.aspect) ? req.aspect : "16:9";
  const model = imageModel(req.model).id;

  const { data: outs } = await supabase.from("outputs").select("id, number, current_version").eq("project_id", projectId).in("number", [13, 15, 17]);
  const withV = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = withV.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", withV.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = withV.find((x) => x.number === n);
    return o ? versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content : undefined;
  };
  const frames = ((content(17) as { frames?: Frame[] } | undefined)?.frames ?? []).filter((f) => req.frames.includes(f.n) && f.prompt?.trim());
  if (!frames.length) throw new Error(t.project.docs.notWritten);

  // Library photos of the characters and places in each frame guide the drawing.
  const castLib = new Map<string, string>();
  for (const c of ((content(13) as { characters?: { name: string; library_id: string | null }[] } | undefined)?.characters ?? [])) if (c.library_id) castLib.set(c.name.trim().toLowerCase(), c.library_id);
  const placeLib = new Map<string, string>();
  for (const l of ((content(15) as { locations?: { name: string; library_id: string | null }[] } | undefined)?.locations ?? [])) if (l.library_id) placeLib.set(l.name.trim().toLowerCase(), l.library_id);
  const ids = (m: Map<string, string>) => [...new Set(m.values())].filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const [{ data: chars }, { data: places }] = await Promise.all([
    ids(castLib).length ? supabase.from("characters").select("id, image_paths").eq("workspace_id", project.workspace_id).in("id", ids(castLib)) : Promise.resolve({ data: [] as { id: string; image_paths: string[] }[] }),
    ids(placeLib).length ? supabase.from("locations").select("id, image_paths").eq("workspace_id", project.workspace_id).in("id", ids(placeLib)) : Promise.resolve({ data: [] as { id: string; image_paths: string[] }[] }),
  ]);
  const admin = createAdminClient();
  const photo = new Map<string, string>();
  for (const row of [...(chars ?? []), ...(places ?? [])]) {
    const path = row.image_paths?.[0];
    if (!path || !path.startsWith(`${project.workspace_id}/`) || path.includes("..")) continue;
    const { data } = await admin.storage.from("media").createSignedUrl(path, 3600);
    if (data?.signedUrl) photo.set(row.id, data.signedUrl);
  }
  const refsFor = (f: Frame) => {
    const out: string[] = [];
    for (const name of f.cast ?? []) {
      const id = castLib.get(name.trim().toLowerCase());
      if (id && photo.has(id)) out.push(photo.get(id)!);
    }
    const place = f.set ? placeLib.get(f.set.trim().toLowerCase()) : undefined;
    if (place && photo.has(place)) out.push(photo.get(place)!);
    return [...new Set(out)].slice(0, 4);
  };

  // A frame already being drawn (a second press, or a second tab) is left alone.
  const recent = new Date(Date.now() - 6 * 60_000).toISOString();
  const { data: rows } = await admin.from("frame_images").select("n, version, status, updated_at").eq("project_id", projectId);
  const busy = new Set((rows ?? []).filter((r) => r.status === "generating" && r.updated_at >= recent).map((r) => r.n));
  const nextVersion = (n: number) => Math.max(0, ...(rows ?? []).filter((r) => r.n === n).map((r) => r.version)) + 1;
  const todo = frames.filter((f) => !busy.has(f.n));
  if (!todo.length) throw new Error(t.project.alreadyWriting);

  // Remember the model picked for this project's images.
  await supabase.from("projects").update({ models: { ...((project.models ?? {}) as object), image: model } }).eq("id", projectId);

  const runStart = Date.now();
  let accountProblem: string | null = null;
  let failed = 0;

  const drawFrame = async (f: Frame) => {
    const refs = refsFor(f);
    const prompt = `${f.prompt.trim()}\n\n${refs.length ? "Keep the people and the place looking like the reference photos. " : ""}${STYLE_PROMPT[style]}`.slice(0, 3900);
    const version = nextVersion(f.n);
    const { data: row, error } = await admin
      .from("frame_images")
      .insert({ workspace_id: project.workspace_id, project_id: projectId, n: f.n, version, style, aspect, model, prompt, created_by: me.userId })
      .select("id")
      .single();
    if (error || !row) {
      failed++;
      emit({ t: "drawFailed", n: f.n, reason: "Could not start this frame." });
      return;
    }
    const fail = async (reason: string) => {
      failed++;
      await admin.from("frame_images").update({ status: "failed", error: reason.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", row.id);
      emit({ t: "drawFailed", n: f.n, reason });
    };
    if (accountProblem || signal?.aborted) return fail(accountProblem ?? "Stopped");
    if (Date.now() - runStart > RUN_LIMIT_MS) return fail(t.project.frames.outOfTime);

    emit({ t: "drawing", n: f.n, total: frames.length, model: imageModel(model).name });
    const tries: string[] = [model, model, imageBackup(model)];
    let lastError = "";
    for (let i = 0; i < tries.length; i++) {
      const m = tries[i];
      if (signal?.aborted) return fail("Stopped");
      if (i === 2) emit({ t: "drawBackup", n: f.n, from: imageModel(model).name, to: imageModel(m).name });
      try {
        const d = await drawOnce(m, prompt, aspect, refs, signal);
        // Copy the image to our own storage; Kie's links expire.
        const res = await fetch(d.url, { signal });
        if (!res.ok) throw new Error(`Could not download the image (${res.status}).`);
        const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
        const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
        const path = `${project.workspace_id}/projects/${projectId}/frames/${f.n}-v${version}.${ext}`;
        const up = await admin.storage.from("media").upload(path, await res.arrayBuffer(), { contentType: type, upsert: true });
        if (up.error) throw new Error(up.error.message);
        const cost = Math.round(d.credits * KIE_USD_PER_CREDIT * 10000) / 10000;
        await admin
          .from("frame_images")
          .update({ status: "ready", model: m, task_id: d.taskId, path, cost_usd: cost, error: null, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        await logAiJob({
          workspaceId: project.workspace_id,
          projectId,
          userId: me.userId,
          task: "storyboard-frame",
          provider: "kie.ai",
          model: m,
          ok: true,
          usage: { inputTokens: 0, outputTokens: 0, costUsd: cost, seconds: Math.round(d.seconds) },
          fallbackFrom: m !== model ? model : undefined,
        });
        emit({ t: "drawn", n: f.n });
        return;
      } catch (e) {
        if (e instanceof AccountError) {
          accountProblem = e.message;
          return fail(e.message);
        }
        lastError = e instanceof Error ? e.message : String(e);
        if (signal?.aborted) return fail("Stopped");
        await logAiJob({ workspaceId: project.workspace_id, projectId, userId: me.userId, task: "storyboard-frame", provider: "kie.ai", model: m, ok: false, error: lastError });
        // A model that cannot draw without a reference goes straight to the backup.
        if (lastError.includes("reference photo") && i === 0) i = 1;
      }
    }
    await fail(lastError || "The model could not draw this frame.");
  };

  // Three at a time.
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: Math.min(AT_ONCE, queue.length) }, async () => {
      while (queue.length) await drawFrame(queue.shift()!);
    }),
  );

  if (accountProblem) {
    await notify({ workspaceId: project.workspace_id, projectId, kind: "ai_failed", title: "Kie.ai stopped the storyboard frames", body: accountProblem });
    throw new Error(t.project.frames.accountProblem);
  }
  if (failed && !signal?.aborted) {
    await notify({ workspaceId: project.workspace_id, projectId, kind: "ai_failed", title: `${failed} storyboard frame${failed > 1 ? "s" : ""} could not be drawn`, body: "Nothing was charged for them. Draw them again from the storyboard." });
  }
}

// Short-lived links to the newest image of each frame, for the storyboard screen.
export async function frameImages(projectId: string, workspaceId: string, supabase: Awaited<ReturnType<typeof loadProject>>["supabase"]) {
  const { data } = await supabase
    .from("frame_images")
    .select("n, version, status, style, model, path, cost_usd, error, updated_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false });
  const latest = new Map<number, NonNullable<typeof data>[number]>();
  const lastGood = new Map<number, NonNullable<typeof data>[number]>();
  for (const r of data ?? []) {
    if (!latest.has(r.n)) latest.set(r.n, r);
    if (r.status === "ready" && r.path && !lastGood.has(r.n)) lastGood.set(r.n, r);
  }
  const paths = [...lastGood.values()].map((r) => r.path!).filter((p) => p.startsWith(`${workspaceId}/projects/${projectId}/frames/`) && !p.includes(".."));
  const urls = new Map<string, string>();
  if (paths.length) {
    try {
      const { data: signed } = await createAdminClient().storage.from("media").createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    } catch {
      // No links: the frames show without images.
    }
  }
  const out: Record<number, { status: string; url: string | null; model: string; style: string; cost: number | null; error: string | null; updatedAt: string; version: number }> = {};
  for (const [n, r] of latest) {
    const good = lastGood.get(n);
    out[n] = { status: r.status, url: good?.path ? urls.get(good.path) ?? null : null, model: r.model, style: r.style, cost: good?.cost_usd == null ? null : Number(good.cost_usd), error: r.error, updatedAt: r.updated_at, version: good?.version ?? 0 };
  }
  return out;
}
