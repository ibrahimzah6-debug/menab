import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASPECTS, STYLE_PROMPT, imageBackup, imageModel, imageRequest, type Aspect, type Style } from "@/lib/ai/images";
import { createTask, getTask, KIE_USD_PER_CREDIT, KieError } from "@/lib/ai/kie";
import { loadProject } from "@/lib/brief-turn";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, notify } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";

// Draws pictures on Kie.ai for stage 3, three at a time: storyboard frames (output 17) and one
// reference picture per character (13) and location (15). Each picture: start the job, wait for
// it, copy the image to our own storage, then record its real cost. A failed job is tried once
// more, then on the backup model. A picture that still fails costs nothing.

export type FrameEvent =
  | { t: "drawing"; n: number; total: number; model: string }
  | { t: "drawn"; n: number }
  | { t: "drawBackup"; n: number; from: string; to: string }
  | { t: "drawFailed"; n: number; reason: string }
  | { t: "drawingRef"; name: string; model: string }
  | { t: "drawnRef"; name: string }
  | { t: "drawRefFailed"; name: string; reason: string };

type Frame = { n: number; prompt: string; cast?: string[]; set?: string };
type Character = { name: string; role?: string; age?: string; look?: string; library_id?: string | null; made_with?: string };
type Location = { name: string; int_ext?: string; description?: string; library_id?: string | null; made_with?: string };
type Outfit = { character: string; outfit: string };
type Admin = ReturnType<typeof createAdminClient>;
type Drawn = { url: string; credits: number; seconds: number; model: string; taskId: string };

const POLL_MS = 2500;
const FRAME_LIMIT_MS = 130_000;
const RUN_LIMIT_MS = 250_000;
const AT_ONCE = 3;
// Kie answers these when the account itself has a problem: stop the whole run.
const ACCOUNT = new Set([401, 402, 433]);
const REF_STYLE = "Photo-real: natural skin texture, real light and shadows, shot on a cinema camera, not illustrated, not CGI. No text, no labels, no logos.";

export const lookKey = (name: string) => name.trim().toLowerCase().slice(0, 200);

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
    if (task.state === "fail") throw new Error(task.failMsg || "The model could not draw this picture.");
  }
  throw new Error("The model took too long.");
}

// One picture with retry and backup, saved to our storage and logged. Returns where it is.
async function drawAndStore(o: {
  admin: Admin;
  model: string;
  prompt: string;
  aspect: Aspect;
  refs: string[];
  pathFor: (ext: string) => string;
  log: { workspaceId: string; projectId: string; userId: string; task: string };
  onBackup: (from: string, to: string) => void;
  signal?: AbortSignal;
}) {
  const tries = [o.model, o.model, imageBackup(o.model)];
  let lastError = "";
  for (let i = 0; i < tries.length; i++) {
    const m = tries[i];
    if (o.signal?.aborted) throw new Error("Stopped");
    if (i === 2) o.onBackup(imageModel(o.model).name, imageModel(m).name);
    try {
      const d = await drawOnce(m, o.prompt, o.aspect, o.refs, o.signal);
      // Copy the image to our own storage; Kie's links expire.
      const res = await fetch(d.url, { signal: o.signal });
      if (!res.ok) throw new Error(`Could not download the image (${res.status}).`);
      const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = o.pathFor(ext);
      const up = await o.admin.storage.from("media").upload(path, await res.arrayBuffer(), { contentType: type, upsert: true });
      if (up.error) throw new Error(up.error.message);
      const cost = Math.round(d.credits * KIE_USD_PER_CREDIT * 10000) / 10000;
      await logAiJob({ ...o.log, provider: "kie.ai", model: m, ok: true, usage: { inputTokens: 0, outputTokens: 0, costUsd: cost, seconds: Math.round(d.seconds) }, fallbackFrom: m !== o.model ? o.model : undefined });
      return { model: m, taskId: d.taskId, path, cost };
    } catch (e) {
      if (e instanceof AccountError) throw e;
      lastError = e instanceof Error ? e.message : String(e);
      if (o.signal?.aborted) throw new Error("Stopped");
      await logAiJob({ ...o.log, provider: "kie.ai", model: m, ok: false, error: lastError });
      // A model that cannot draw without a reference goes straight to the backup.
      if (lastError.includes("reference photo") && i === 0) i = 1;
    }
  }
  throw new Error(lastError || "The model could not draw this picture.");
}

// Runs jobs three at a time.
async function inBatches<T>(items: T[], run: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, async () => { while (queue.length) await run(queue.shift()!); }));
}

// The current content of stage 3's documents.
async function stageThree(supabase: SupabaseClient, projectId: string) {
  const { data: outs } = await supabase.from("outputs").select("id, number, current_version").eq("project_id", projectId).in("number", [13, 14, 15, 17]);
  const withV = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = withV.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", withV.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = withV.find((x) => x.number === n);
    return o ? versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content : undefined;
  };
  return {
    characters: ((content(13) as { characters?: Character[] } | undefined)?.characters ?? []).filter((c) => c.name?.trim()),
    wardrobe: (content(14) as { wardrobe?: Outfit[] } | undefined)?.wardrobe ?? [],
    locations: ((content(15) as { locations?: Location[] } | undefined)?.locations ?? []).filter((l) => l.name?.trim()),
    frames: (content(17) as { frames?: Frame[] } | undefined)?.frames ?? [],
  };
}

// AI characters and AI locations that still have no picture. The storyboard is drawn from these
// pictures, so frames wait for them, and stage 3 is not approved without them. Real actors, real
// places and library entries (which have their own photos) are not counted.
export async function missingPictures(supabase: SupabaseClient, projectId: string): Promise<string[]> {
  const doc = await stageThree(supabase, projectId);
  const { data } = await supabase.from("look_images").select("kind, key").eq("project_id", projectId).eq("status", "ready");
  const have = new Set((data ?? []).map((r) => `${r.kind}:${r.key}`));
  const out: string[] = [];
  for (const c of doc.characters) if (c.made_with !== "cast" && !c.library_id && !have.has(`character:${lookKey(c.name)}`)) out.push(c.name);
  for (const l of doc.locations) if (l.made_with !== "real" && !l.library_id && !have.has(`location:${lookKey(l.name)}`)) out.push(l.name);
  return out;
}

// Signed links to the pictures that guide a drawing: this project's reference pictures first,
// else the first photo of a library character or location.
async function referencePhotos(supabase: SupabaseClient, admin: Admin, project: { id: string; workspace_id: string }, doc: Awaited<ReturnType<typeof stageThree>>) {
  const sign = async (path: string | null | undefined) => {
    if (!path || !path.startsWith(`${project.workspace_id}/`) || path.includes("..")) return null;
    const { data } = await admin.storage.from("media").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };
  const { data: look } = await supabase.from("look_images").select("kind, key, version, path").eq("project_id", project.id).eq("status", "ready").order("version", { ascending: false });
  const own = new Map<string, string>();
  for (const r of look ?? []) if (!own.has(`${r.kind}:${r.key}`) && r.path) own.set(`${r.kind}:${r.key}`, r.path);
  const libIds = [...doc.characters, ...doc.locations].map((x) => x.library_id).filter((x): x is string => Boolean(x && /^[0-9a-f-]{36}$/i.test(x)));
  const [{ data: chars }, { data: places }] = libIds.length
    ? await Promise.all([
        supabase.from("characters").select("id, image_paths").eq("workspace_id", project.workspace_id).in("id", libIds),
        supabase.from("locations").select("id, image_paths").eq("workspace_id", project.workspace_id).in("id", libIds),
      ])
    : [{ data: [] as { id: string; image_paths: string[] }[] }, { data: [] as { id: string; image_paths: string[] }[] }];
  const lib = new Map<string, string>();
  for (const r of [...(chars ?? []), ...(places ?? [])]) if (r.image_paths?.[0]) lib.set(r.id, r.image_paths[0]);
  const cache = new Map<string, string | null>();
  const urlFor = async (kind: "character" | "location", name: string, libraryOnly = false) => {
    const k = `${kind}:${lookKey(name)}`;
    if (cache.has(k + libraryOnly)) return cache.get(k + libraryOnly)!;
    const item = kind === "character" ? doc.characters.find((c) => lookKey(c.name) === lookKey(name)) : doc.locations.find((l) => lookKey(l.name) === lookKey(name));
    const path = (!libraryOnly && own.get(k)) || (item?.library_id ? lib.get(item.library_id) : undefined);
    const url = await sign(path);
    cache.set(k + libraryOnly, url);
    return url;
  };
  return urlFor;
}

// Storyboard frames.
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

  const doc = await stageThree(supabase, projectId);
  const waiting = await missingPictures(supabase, projectId);
  if (waiting.length) throw new Error(fill(t.project.frames.picturesFirst, { names: waiting.join(", ") }));
  const frames = doc.frames.filter((f) => req.frames.includes(f.n) && f.prompt?.trim());
  if (!frames.length) throw new Error(t.project.docs.notWritten);

  const admin = createAdminClient();
  const urlFor = await referencePhotos(supabase, admin, project, doc);
  const refsFor = async (f: Frame) => {
    const out: string[] = [];
    for (const name of f.cast ?? []) {
      const u = await urlFor("character", name);
      if (u) out.push(u);
    }
    if (f.set) {
      const u = await urlFor("location", f.set);
      if (u) out.push(u);
    }
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

  await inBatches(todo, async (f) => {
    const refs = await refsFor(f);
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
    try {
      const d = await drawAndStore({
        admin,
        model,
        prompt,
        aspect,
        refs,
        pathFor: (ext) => `${project.workspace_id}/projects/${projectId}/frames/${f.n}-v${version}.${ext}`,
        log: { workspaceId: project.workspace_id, projectId, userId: me.userId, task: "storyboard-frame" },
        onBackup: (from, to) => emit({ t: "drawBackup", n: f.n, from, to }),
        signal,
      });
      await admin.from("frame_images").update({ status: "ready", model: d.model, task_id: d.taskId, path: d.path, cost_usd: d.cost, error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
      emit({ t: "drawn", n: f.n });
    } catch (e) {
      if (e instanceof AccountError) accountProblem = e.message;
      await fail(e instanceof Error ? e.message : String(e));
    }
  });

  await finish(project.workspace_id, projectId, accountProblem, failed, "storyboard frame", signal, t.project.frames.accountProblem);
}

// One reference picture per character or location, for the storyboard and M5's reference lock.
export async function runRefs(
  projectId: string,
  req: { kind: "character" | "location"; names: string[]; model: string },
  emit: (e: FrameEvent) => void,
  signal?: AbortSignal,
) {
  const { me, supabase, project } = await loadProject(projectId);
  const { t } = await getI18n();
  if (project.current_stage !== 3) throw new Error(t.project.notCurrentStage);
  const model = imageModel(req.model).id;
  const doc = await stageThree(supabase, projectId);
  const wanted = new Set(req.names.map(lookKey));
  const items =
    req.kind === "character"
      ? doc.characters.filter((c) => wanted.has(lookKey(c.name))).map((c) => {
          const outfit = doc.wardrobe.find((w) => lookKey(w.character) === lookKey(c.name))?.outfit;
          return {
            name: c.name,
            prompt: `Character reference sheet for a film: ${c.name}${c.role ? `, ${c.role}` : ""}. Age: ${c.age ?? ""}. ${c.look ?? ""}${outfit ? ` Wearing: ${outfit}.` : ""} Three views side by side on one plain light grey background: full body from the front, full body three-quarter, and a close-up of the face. Even soft studio light, neutral expression.`,
          };
        })
      : doc.locations.filter((l) => wanted.has(lookKey(l.name))).map((l) => ({
          name: l.name,
          prompt: `Location reference for a film: ${l.name}${l.int_ext ? ` (${l.int_ext})` : ""}. ${l.description ?? ""} A wide establishing view at eye level, no people.`,
        }));
  if (!items.length) throw new Error(t.project.docs.notWritten);

  const admin = createAdminClient();
  const urlFor = await referencePhotos(supabase, admin, project, doc);
  const recent = new Date(Date.now() - 6 * 60_000).toISOString();
  const { data: rows } = await admin.from("look_images").select("key, version, status, updated_at").eq("project_id", projectId).eq("kind", req.kind);
  const busy = new Set((rows ?? []).filter((r) => r.status === "generating" && r.updated_at >= recent).map((r) => r.key));
  const todo = items.filter((x) => !busy.has(lookKey(x.name)));
  if (!todo.length) throw new Error(t.project.alreadyWriting);
  await supabase.from("projects").update({ models: { ...((project.models ?? {}) as object), image: model } }).eq("id", projectId);

  let accountProblem: string | null = null;
  let failed = 0;
  await inBatches(todo, async (x) => {
    const key = lookKey(x.name);
    // A library photo of the same character or place keeps the face or the place.
    const lib = await urlFor(req.kind, x.name, true);
    const refs = lib ? [lib] : [];
    const prompt = `${x.prompt}${refs.length ? " Keep them looking like the reference photo." : ""}\n\n${REF_STYLE}`.slice(0, 3900);
    const version = Math.max(0, ...(rows ?? []).filter((r) => r.key === key).map((r) => r.version)) + 1;
    const { data: row, error } = await admin
      .from("look_images")
      .insert({ workspace_id: project.workspace_id, project_id: projectId, kind: req.kind, key, version, model, prompt, created_by: me.userId })
      .select("id")
      .single();
    const fail = async (reason: string) => {
      failed++;
      if (row) await admin.from("look_images").update({ status: "failed", error: reason.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", row.id);
      emit({ t: "drawRefFailed", name: x.name, reason });
    };
    if (error || !row) return fail("Could not start this picture.");
    if (accountProblem || signal?.aborted) return fail(accountProblem ?? "Stopped");
    emit({ t: "drawingRef", name: x.name, model: imageModel(model).name });
    try {
      // Storage accepts Latin letters only: an Arabic name stays the label, never the file name.
      const slug = key.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item";
      const d = await drawAndStore({
        admin,
        model,
        prompt,
        aspect: "16:9",
        refs,
        pathFor: (ext) => `${project.workspace_id}/projects/${projectId}/look/${req.kind}-${row.id}-${slug}.${ext}`,
        log: { workspaceId: project.workspace_id, projectId, userId: me.userId, task: `look-${req.kind}` },
        onBackup: () => undefined,
        signal,
      });
      await admin.from("look_images").update({ status: "ready", model: d.model, task_id: d.taskId, path: d.path, cost_usd: d.cost, error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
      emit({ t: "drawnRef", name: x.name });
    } catch (e) {
      if (e instanceof AccountError) accountProblem = e.message;
      await fail(e instanceof Error ? e.message : String(e));
    }
  });

  await finish(project.workspace_id, projectId, accountProblem, failed, req.kind === "character" ? "character picture" : "location picture", signal, t.project.frames.accountProblem);
}

async function finish(workspaceId: string, projectId: string, accountProblem: string | null, failed: number, what: string, signal: AbortSignal | undefined, accountMessage: string) {
  if (accountProblem) {
    await notify({ workspaceId, projectId, kind: "ai_failed", title: "Kie.ai stopped the drawing", body: accountProblem });
    throw new Error(accountMessage);
  }
  if (failed && !signal?.aborted) {
    await notify({ workspaceId, projectId, kind: "ai_failed", title: `${failed} ${what}${failed > 1 ? "s" : ""} could not be drawn`, body: "Nothing was charged for them. Draw them again." });
  }
}

type ImageRow = { status: string; path: string | null; cost_usd: number | string | null; error: string | null; updated_at: string; version: number; model: string };

async function signAll(paths: string[]) {
  const urls = new Map<string, string>();
  if (!paths.length) return urls;
  try {
    const { data: signed } = await createAdminClient().storage.from("media").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  } catch {
    // No links: shown without images.
  }
  return urls;
}

// The newest row and the newest drawn picture of each item, with a short-lived link.
function latestOf<K extends string | number>(rows: (ImageRow & { k: K })[], prefix: string, urls: Map<string, string>) {
  const latest = new Map<K, ImageRow & { k: K }>();
  const good = new Map<K, ImageRow & { k: K }>();
  for (const r of rows) {
    if (!latest.has(r.k)) latest.set(r.k, r);
    if (r.status === "ready" && r.path && !good.has(r.k)) good.set(r.k, r);
  }
  const out = new Map<K, { status: string; url: string | null; model: string; cost: number | null; error: string | null; updatedAt: string; version: number }>();
  for (const [k, r] of latest) {
    const g = good.get(k);
    out.set(k, { status: r.status, url: g?.path && g.path.startsWith(prefix) ? urls.get(g.path) ?? null : null, model: r.model, cost: g?.cost_usd == null ? null : Number(g.cost_usd), error: r.error, updatedAt: r.updated_at, version: g?.version ?? 0 });
  }
  return { out, paths: [...good.values()].map((r) => r.path!).filter((p) => p.startsWith(prefix) && !p.includes("..")) };
}

// Storyboard frames for the screen.
export async function frameImages(projectId: string, workspaceId: string, supabase: SupabaseClient) {
  const { data } = await supabase.from("frame_images").select("n, version, status, style, model, path, cost_usd, error, updated_at").eq("project_id", projectId).order("version", { ascending: false });
  const prefix = `${workspaceId}/projects/${projectId}/frames/`;
  const rows = (data ?? []).map((r) => ({ ...r, k: r.n as number }));
  const first = latestOf(rows, prefix, new Map());
  const urls = await signAll(first.paths);
  const { out } = latestOf(rows, prefix, urls);
  const style = new Map<number, string>();
  for (const r of rows) if (!style.has(r.n)) style.set(r.n, r.style);
  const result: Record<number, { status: string; url: string | null; model: string; style: string; cost: number | null; error: string | null; updatedAt: string; version: number }> = {};
  for (const [n, x] of out) result[n] = { ...x, style: style.get(n) ?? "sketch" };
  return result;
}

// Character and location pictures for the screen, keyed by name.
export async function lookImages(projectId: string, workspaceId: string, supabase: SupabaseClient) {
  const { data } = await supabase.from("look_images").select("kind, key, version, status, model, path, cost_usd, error, updated_at").eq("project_id", projectId).order("version", { ascending: false });
  const prefix = `${workspaceId}/projects/${projectId}/look/`;
  const rows = (data ?? []).map((r) => ({ ...r, k: `${r.kind}:${r.key}` }));
  const first = latestOf(rows, prefix, new Map());
  const urls = await signAll(first.paths);
  const { out } = latestOf(rows, prefix, urls);
  return Object.fromEntries(out) as Record<string, { status: string; url: string | null; model: string; cost: number | null; error: string | null; updatedAt: string; version: number }>;
}
