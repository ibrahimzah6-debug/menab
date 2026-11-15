import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clipBackup, clipModel, clipRequest, clipSeconds, DEFAULT_CLIP_MODEL, DEFAULT_NARRATOR, musicRequest, voiceRequest } from "@/lib/ai/media";
import { ASPECTS, imageBackup, imageModel, imageRequest, type Aspect } from "@/lib/ai/images";
import { createTask, getTask, KIE_USD_PER_CREDIT, KieError } from "@/lib/ai/kie";
import { loadProject } from "@/lib/brief-turn";
import { lookKey } from "@/lib/frames";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, notify } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";

// Stage 5, Generate (AI path): digital actor sheets and outfit pictures (34), keyframes (35),
// video clips (36), voice lines and the music track (37), reviewed in 38. Every job is started on
// Kie.ai and its task id saved at once; Menab waits for it, copies the file to our storage and
// records the real cost. A failed job is tried once more, then on the backup model; a job that
// still fails costs nothing. A job still running when the request ends is collected later.

export type GenKind = "sheet" | "outfit" | "keyframe" | "clip" | "voice" | "music";
export type GenEvent =
  | { t: "genStart"; label: string; model: string }
  | { t: "genDone"; label: string }
  | { t: "genBackup"; label: string; from: string; to: string }
  | { t: "genFailed"; label: string; reason: string }
  | { t: "genLater"; label: string };

type Admin = ReturnType<typeof createAdminClient>;
type Job = { key: string; label: string; model: string; prompt: string; params: Record<string, unknown>; build: (model: string) => { kieModel: string; input: Record<string, unknown> } | null; backup: (model: string) => string; modelName: (id: string) => string; seconds?: number };

const POLL_MS = 3000;
const RUN_LIMIT_MS = 255_000;
const ACCOUNT = new Set([401, 402, 433]);
const PHOTO = "Photo-real film still: natural skin texture, real light and shadows, shot on a cinema camera with a real lens, subtle film grain, not illustrated, not CGI, no text, no logos unless asked.";

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });

// ---------- What stage 5 works from ----------

export type Shot = { n: number; scene: string; size: string; angle: string; movement: string; lens: string; action: string; dialogue: string; seconds: number; cast: string[]; set: string; prompt: string };

export async function stageFive(supabase: SupabaseClient, projectId: string) {
  const { data: outs } = await supabase.from("outputs").select("id, number, status, current_version").eq("project_id", projectId).in("number", [9, 11, 13, 14, 15, 17, 34]);
  const withV = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = withV.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", withV.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = withV.find((x) => x.number === n);
    return o ? (versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content as Record<string, unknown> | undefined) : undefined;
  };
  const characters = ((content(13)?.characters as { name: string; role?: string; age?: string; look?: string; made_with?: string; library_id?: string | null }[] | undefined) ?? []).filter((c) => c.name?.trim());
  const wardrobe = (content(14)?.wardrobe as { character: string; scene: string; outfit: string }[] | undefined) ?? [];
  const locations = ((content(15)?.locations as { name: string; description?: string; int_ext?: string; library_id?: string | null }[] | undefined) ?? []).filter((l) => l.name?.trim());
  const shots = ((content(17)?.frames as Shot[] | undefined) ?? []).filter((f) => f.n);
  const script = (content(9)?.rows as { vo_ar?: string; vo_en?: string; seconds?: number }[] | undefined) ?? [];
  const mood = (content(11) ?? {}) as { look?: string; grade?: string; references?: string[] };
  const lock = (content(34) ?? {}) as { locked?: boolean; consent?: boolean; narrator?: string; voices?: Record<string, string>; aspect?: string };
  // Outfits that change between scenes need their own picture; one outfit is shown on the sheet.
  const outfits = characters.flatMap((c) => {
    const list = [...new Set(wardrobe.filter((w) => lookKey(w.character) === lookKey(c.name)).map((w) => w.outfit.trim()).filter(Boolean))];
    return list.length > 1 ? list.map((o) => ({ character: c.name, outfit: o })) : [];
  });
  return { characters, wardrobe, locations, shots, script, mood, lock, outfits };
}

// The newest row of each item, with short-lived links to the files.
export async function genAssets(supabase: SupabaseClient, projectId: string, workspaceId: string) {
  const { data } = await supabase.from("gen_assets").select("id, kind, key, version, status, approved, model, prompt, params, path, seconds, cost_usd, error, updated_at").eq("project_id", projectId).order("version", { ascending: false });
  const latest = new Map<string, NonNullable<typeof data>[number]>();
  const good = new Map<string, NonNullable<typeof data>[number]>();
  for (const r of data ?? []) {
    const k = `${r.kind}:${r.key}`;
    if (!latest.has(k)) latest.set(k, r);
    if (r.status === "ready" && r.path && !good.has(k)) good.set(k, r);
  }
  const prefix = `${workspaceId}/projects/${projectId}/`;
  const paths = [...good.values()].map((r) => r.path!).filter((p) => p.startsWith(prefix) && !p.includes(".."));
  const urls = new Map<string, string>();
  if (paths.length) {
    try {
      const { data: signed } = await createAdminClient().storage.from("media").createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    } catch {
      // No links: shown without media.
    }
  }
  const out: Record<string, { id: string; status: string; approved: boolean; model: string; prompt: string; url: string | null; version: number; seconds: number | null; cost: number | null; error: string | null; updatedAt: string; params: Record<string, unknown> }> = {};
  for (const [k, r] of latest) {
    const g = good.get(k);
    out[k] = { id: r.id, status: r.status, approved: Boolean(g?.approved), model: r.model, prompt: r.prompt, url: g?.path ? urls.get(g.path) ?? null : null, version: g?.version ?? 0, seconds: g?.seconds == null ? null : Number(g.seconds), cost: g?.cost_usd == null ? null : Number(g.cost_usd), error: r.error, updatedAt: r.updated_at, params: (r.params ?? {}) as Record<string, unknown> };
  }
  return out;
}

// ---------- Saving a finished job ----------

async function store(admin: Admin, row: { id: string; workspace_id: string; project_id: string; kind: string; model: string; created_by: string | null; seconds?: number | null }, url: string, credits: number, fallbackFrom?: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the file (${res.status}).`);
  const type = res.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : type.includes("mp4") ? "mp4" : type.includes("webm") ? "webm" : type.includes("wav") ? "wav" : type.includes("mpeg") || type.includes("mp3") ? "mp3" : url.split("?")[0].split(".").pop()?.slice(0, 5) || "bin";
  const path = `${row.workspace_id}/projects/${row.project_id}/generate/${row.kind}-${row.id}.${ext}`;
  const up = await admin.storage.from("media").upload(path, await res.arrayBuffer(), { contentType: type, upsert: true });
  if (up.error) throw new Error(up.error.message);
  const cost = Math.round(credits * KIE_USD_PER_CREDIT * 10000) / 10000;
  await admin.from("gen_assets").update({ status: "ready", path, cost_usd: cost, error: null, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (row.created_by) {
    await logAiJob({ workspaceId: row.workspace_id, projectId: row.project_id, userId: row.created_by, task: `generate-${row.kind}`, provider: "kie.ai", model: row.model, ok: true, usage: { inputTokens: 0, outputTokens: 0, costUsd: cost, seconds: Math.round(Number(row.seconds ?? 0)) }, fallbackFrom });
  }
}

// Jobs that were still running when their request ended: collect the finished ones.
export async function settlePending(projectId: string) {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }
  const { data: rows } = await admin.from("gen_assets").select("id, workspace_id, project_id, kind, model, created_by, task_id, seconds, updated_at").eq("project_id", projectId).eq("status", "generating").limit(12);
  const now = Date.now();
  await Promise.all(
    (rows ?? []).map(async (r) => {
      const age = now - new Date(r.updated_at).getTime();
      if (age < 20_000) return;
      if (!r.task_id || age > 40 * 60_000) {
        await admin.from("gen_assets").update({ status: "failed", error: "Stopped before it finished. Nothing was charged.", updated_at: new Date().toISOString() }).eq("id", r.id);
        return;
      }
      const task = await getTask(r.task_id).catch(() => null);
      if (!task) return;
      if (task.state === "success" && task.resultUrls[0]) {
        await store(admin, r, task.resultUrls[0], task.credits ?? 0).catch(async (e) => {
          await admin.from("gen_assets").update({ status: "failed", error: String(e instanceof Error ? e.message : e).slice(0, 500), updated_at: new Date().toISOString() }).eq("id", r.id);
        });
      } else if (task.state === "fail") {
        await admin.from("gen_assets").update({ status: "failed", error: (task.failMsg || "The model could not make this.").slice(0, 500), updated_at: new Date().toISOString() }).eq("id", r.id);
      }
    }),
  );
  await syncOutputs(admin, projectId);
}

// Outputs 35 to 38 are ready when every shot has its keyframe, clip, and approval.
export async function syncOutputs(admin: Admin, projectId: string) {
  const { data: outs } = await admin.from("outputs").select("id, number, status, current_version").eq("project_id", projectId).in("number", [17, 34, 35, 36, 37, 38]);
  const sb = (outs ?? []).find((o) => o.number === 17);
  if (!sb) return;
  const { data: v } = await admin.from("versions").select("content").eq("output_id", sb.id).eq("version", sb.current_version).maybeSingle();
  const shots = ((v?.content as { frames?: { n: number }[] } | null)?.frames ?? []).map((f) => String(f.n));
  const { data: rows } = await admin.from("gen_assets").select("kind, key, status, approved, version").eq("project_id", projectId).order("version", { ascending: false });
  const ready = (kind: string) => new Set((rows ?? []).filter((r) => r.kind === kind && r.status === "ready").map((r) => r.key));
  const approved = new Set((rows ?? []).filter((r) => r.kind === "clip" && r.status === "ready" && r.approved).map((r) => r.key));
  const generating = (kind: string) => (rows ?? []).some((r) => r.kind === kind && r.status === "generating");
  const state = (n: number, done: boolean, busy: boolean) => {
    const o = (outs ?? []).find((x) => x.number === n);
    if (!o || o.status === "approved") return null;
    const status = busy ? "generating" : done ? "ready" : "waiting";
    return o.status === status ? null : admin.from("outputs").update({ status, updated_at: new Date().toISOString() }).eq("id", o.id);
  };
  const all = (set: Set<string>) => shots.length > 0 && shots.every((n) => set.has(n));
  await Promise.all(
    [
      state(35, all(ready("keyframe")), generating("keyframe")),
      state(36, all(ready("clip")), generating("clip")),
      state(37, ready("voice").size > 0 || ready("music").size > 0, generating("voice") || generating("music")),
      state(38, all(approved), false),
    ].filter(Boolean),
  );
}

// ---------- Running jobs ----------

export type GenRequest =
  | { kind: "sheet"; names: string[] }
  | { kind: "outfit"; keys: string[] }
  | { kind: "keyframe"; shots: number[]; model?: string }
  | { kind: "clip"; shots: number[]; model?: string; prompts?: Record<string, string> }
  | { kind: "voice"; keys: string[] }
  | { kind: "music" };

export async function runGenerate(projectId: string, req: GenRequest, emit: (e: GenEvent) => void, signal?: AbortSignal) {
  const { me, supabase, project } = await loadProject(projectId);
  const { t } = await getI18n();
  if (project.current_stage !== 5) throw new Error(t.project.notCurrentStage);
  const g = t.generate;
  const admin = createAdminClient();
  const doc = await stageFive(supabase, projectId);
  const brief = (project.brief ?? {}) as { language?: string; feeling?: string };
  const aspect: Aspect = ASPECTS.includes(doc.lock.aspect as Aspect) ? (doc.lock.aspect as Aspect) : "16:9";
  // Final pictures use the strongest model for keeping faces the same, unless another is picked.
  const imgModel = imageModel(req.kind === "keyframe" && req.model ? req.model : "nano-banana-pro").id;
  const assets = await genAssets(supabase, projectId, project.workspace_id);

  // Signed links to pictures that guide the work.
  const sign = async (path: string | null | undefined) => {
    if (!path || !path.startsWith(`${project.workspace_id}/`) || path.includes("..")) return null;
    const { data } = await admin.storage.from("media").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };
  const { data: look } = await supabase.from("look_images").select("kind, key, path, version").eq("project_id", projectId).eq("status", "ready").order("version", { ascending: false });
  const lookPath = (kind: string, name: string) => look?.find((r) => r.kind === kind && r.key === lookKey(name))?.path ?? null;
  const assetPath = async (kind: string, key: string) => {
    const { data } = await supabase.from("gen_assets").select("path").eq("project_id", projectId).eq("kind", kind).eq("key", key).eq("status", "ready").order("version", { ascending: false }).limit(1);
    return data?.[0]?.path ?? null;
  };

  let jobs: Job[] = [];
  const imageJob = (key: string, label: string, prompt: string, refs: string[], jobAspect: Aspect): Job => ({
    key, label, model: imgModel, prompt, params: { refs: refs.length, aspect: jobAspect },
    build: (m) => imageRequest(m, prompt, jobAspect, refs), backup: imageBackup, modelName: (id) => imageModel(id).name,
  });

  if (req.kind === "sheet") {
    if (doc.lock.locked) throw new Error(g.lockedNote);
    for (const c of doc.characters.filter((x) => req.names.map(lookKey).includes(lookKey(x.name)))) {
      const ref = await sign(lookPath("character", c.name));
      const outfit = doc.wardrobe.find((w) => lookKey(w.character) === lookKey(c.name))?.outfit;
      const prompt = `Digital actor reference sheet for a film, all in one image: ${c.name}${c.role ? `, ${c.role}` : ""}. Age: ${c.age ?? ""}. ${c.look ?? ""}${outfit ? ` Wearing: ${outfit}.` : ""} Left: full body from the front. Middle: full body from the side. Right: four head-and-shoulders close-ups with the expressions neutral, smiling, serious and surprised. Plain light grey studio background, even soft light.${ref ? " Keep the face exactly as in the reference photo." : ""}\n\n${PHOTO}`;
      jobs.push(imageJob(lookKey(c.name), c.name, prompt, ref ? [ref] : [], "16:9"));
    }
  } else if (req.kind === "outfit") {
    if (doc.lock.locked) throw new Error(g.lockedNote);
    for (const o of doc.outfits.filter((x) => req.keys.includes(`${lookKey(x.character)}|${lookKey(x.outfit)}`))) {
      const ref = (await sign(await assetPath("sheet", lookKey(o.character)))) ?? (await sign(lookPath("character", o.character)));
      const prompt = `The same person as in the reference photo, full body from the front, wearing: ${o.outfit}. Plain light grey studio background, even soft light, neutral expression.\n\n${PHOTO}`;
      jobs.push(imageJob(`${lookKey(o.character)}|${lookKey(o.outfit)}`.slice(0, 200), `${o.character}: ${o.outfit}`, prompt, ref ? [ref] : [], "9:16"));
    }
  } else if (req.kind === "keyframe") {
    if (!doc.lock.locked) throw new Error(g.lockFirst);
    for (const s of doc.shots.filter((x) => req.shots.includes(x.n))) {
      const refs: string[] = [];
      for (const name of s.cast ?? []) {
        const outfit = doc.wardrobe.find((w) => lookKey(w.character) === lookKey(name) && (w.scene === s.scene || w.scene.includes(s.scene)))?.outfit;
        const p = (outfit && (await assetPath("outfit", `${lookKey(name)}|${lookKey(outfit)}`.slice(0, 200)))) || (await assetPath("sheet", lookKey(name))) || lookPath("character", name);
        const u = await sign(p);
        if (u) refs.push(u);
      }
      if (s.set) {
        const u = await sign(lookPath("location", s.set));
        if (u) refs.push(u);
      }
      const prompt = `Final film frame. ${s.prompt}${refs.length ? "\nKeep every person, their clothes and the place exactly as in the reference photos." : ""}\n\n${PHOTO}`.slice(0, 5900);
      jobs.push(imageJob(String(s.n), fill(g.shot, { n: s.n }), prompt, refs.slice(0, 4), aspect));
    }
  } else if (req.kind === "clip") {
    const model = clipModel(req.model ?? DEFAULT_CLIP_MODEL).id;
    for (const s of doc.shots.filter((x) => req.shots.includes(x.n))) {
      const kf = await sign(await assetPath("keyframe", String(s.n)));
      if (!kf) {
        emit({ t: "genFailed", label: fill(g.shot, { n: s.n }), reason: g.keyframeFirst });
        continue;
      }
      const prompt = (req.prompts?.[String(s.n)] ?? assets[`clip:${s.n}`]?.prompt ?? `${s.action}. Camera move: ${s.movement}. Shot size: ${s.size}, lens ${s.lens}. Natural, realistic motion; keep the faces, clothes and place exactly as in the first frame. No text on screen.`).slice(0, 2400);
      jobs.push({
        key: String(s.n), label: fill(g.shot, { n: s.n }), model, prompt, params: { seconds: s.seconds, aspect }, seconds: clipSeconds(model, s.seconds),
        build: (m) => clipRequest(m, prompt, kf, s.seconds, aspect), backup: clipBackup, modelName: (id) => clipModel(id).name,
      });
    }
  } else if (req.kind === "voice") {
    const arabic = (brief.language ?? "").toLowerCase().includes("arab");
    const narrator = doc.lock.narrator ?? DEFAULT_NARRATOR;
    doc.script.forEach((row, i) => {
      const text = ((arabic ? row.vo_ar || row.vo_en : row.vo_en || row.vo_ar) ?? "").replace(/^\s*(VO|V\.O\.)\s*:\s*/i, "").trim();
      const key = `vo-${i + 1}`;
      if (!text || !req.keys.includes(key)) return;
      jobs.push({ key, label: fill(g.line, { n: i + 1 }), model: "elevenlabs-multilingual-v2", prompt: text, params: { voice: narrator }, build: () => voiceRequest(text, narrator), backup: (m) => m, modelName: () => "ElevenLabs" });
    });
  } else if (req.kind === "music") {
    const style = [brief.feeling, doc.mood.look, "cinematic score for a short film, instrumental, clean mix"].filter(Boolean).join("; ");
    jobs.push({ key: "main", label: g.music, model: "suno-v6", prompt: style, params: {}, build: () => musicRequest(style, project.name), backup: (m) => m, modelName: () => "Suno V6" });
  }
  if (!jobs.length) throw new Error(g.nothing);

  // A job already running (a second press, or a second tab) is left alone.
  const kind = req.kind;
  const busy = new Set(Object.entries(assets).filter(([k, v]) => k.startsWith(`${kind}:`) && v.status === "generating").map(([k]) => k.slice(kind.length + 1)));
  jobs = jobs.filter((j) => !busy.has(j.key));
  if (!jobs.length) throw new Error(t.project.alreadyWriting);

  const started = Date.now();
  let accountProblem: string | null = null;
  let failed = 0;
  const { data: versions } = await admin.from("gen_assets").select("key, version").eq("project_id", projectId).eq("kind", kind);
  const next = (key: string) => Math.max(0, ...(versions ?? []).filter((r) => r.key === key).map((r) => r.version)) + 1;

  const runJob = async (j: Job) => {
    const { data: row, error } = await admin
      .from("gen_assets")
      .insert({ workspace_id: project.workspace_id, project_id: projectId, kind, key: j.key, version: next(j.key), model: j.model, prompt: j.prompt.slice(0, 6000), params: j.params, seconds: j.seconds ?? null, created_by: me.userId })
      .select("id, workspace_id, project_id, kind, model, created_by, seconds")
      .single();
    if (error || !row) {
      failed++;
      emit({ t: "genFailed", label: j.label, reason: "Could not start." });
      return;
    }
    const fail = async (reason: string) => {
      failed++;
      await admin.from("gen_assets").update({ status: "failed", error: reason.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", row.id);
      emit({ t: "genFailed", label: j.label, reason });
    };
    if (accountProblem || signal?.aborted) return fail(accountProblem ?? "Stopped");
    emit({ t: "genStart", label: j.label, model: j.modelName(j.model) });
    const tries = [j.model, j.model, j.backup(j.model)].filter((m, i, a) => i < 2 || m !== a[0]);
    let last = "";
    for (let i = 0; i < tries.length; i++) {
      const m = tries[i];
      if (i === 2) emit({ t: "genBackup", label: j.label, from: j.modelName(j.model), to: j.modelName(m) });
      const r = j.build(m);
      if (!r) {
        last = "This model needs a reference photo.";
        continue;
      }
      let taskId: string;
      try {
        taskId = await createTask(r.kieModel, r.input);
      } catch (e) {
        if (e instanceof KieError && ACCOUNT.has(e.code)) {
          accountProblem = e.message;
          return fail(e.message);
        }
        last = e instanceof Error ? e.message : String(e);
        await logAiJob({ workspaceId: project.workspace_id, projectId, userId: me.userId, task: `generate-${kind}`, provider: "kie.ai", model: m, ok: false, error: last });
        continue;
      }
      await admin.from("gen_assets").update({ task_id: taskId, model: m, updated_at: new Date().toISOString() }).eq("id", row.id);
      // Wait for it; if the request runs out of time, it is collected later.
      for (;;) {
        if (signal?.aborted) return fail("Stopped");
        if (Date.now() - started > RUN_LIMIT_MS) {
          emit({ t: "genLater", label: j.label });
          return;
        }
        await wait(POLL_MS, signal);
        const task = await getTask(taskId).catch(() => null);
        if (!task) continue;
        if (task.state === "success" && task.resultUrls[0]) {
          try {
            await store(admin, { ...row, model: m }, task.resultUrls[0], task.credits ?? 0, m !== j.model ? j.model : undefined);
            emit({ t: "genDone", label: j.label });
            return;
          } catch (e) {
            last = e instanceof Error ? e.message : String(e);
            break;
          }
        }
        if (task.state === "fail") {
          last = task.failMsg || "The model could not make this.";
          await logAiJob({ workspaceId: project.workspace_id, projectId, userId: me.userId, task: `generate-${kind}`, provider: "kie.ai", model: m, ok: false, error: last });
          break;
        }
      }
    }
    await fail(last || "The model could not make this.");
  };

  const queue = [...jobs];
  const atOnce = kind === "voice" ? 4 : 3;
  await Promise.all(Array.from({ length: Math.min(atOnce, queue.length) }, async () => { while (queue.length) await runJob(queue.shift()!); }));
  await syncOutputs(admin, projectId);

  if (accountProblem) {
    await notify({ workspaceId: project.workspace_id, projectId, kind: "ai_failed", title: "Kie.ai stopped the generation", body: accountProblem });
    throw new Error(t.project.frames.accountProblem);
  }
  if (failed && !signal?.aborted) await notify({ workspaceId: project.workspace_id, projectId, kind: "ai_failed", title: `${failed} generation${failed > 1 ? "s" : ""} failed`, body: "Nothing was charged for them. Try them again." });
}

function fill(s: string, v: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
}
