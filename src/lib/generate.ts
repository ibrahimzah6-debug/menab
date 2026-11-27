import "server-only";
import { mediaUrl } from "@/lib/media-url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLIP_MODELS, clipBackup, clipModel, clipRequest, clipSeconds, DEFAULT_CLIP_MODEL, DEFAULT_TALKING_MODEL, defaultDialect, defaultHow, suggestNarrator, suggestVoices, dialectFor, guessAge, isAge, isDialect, isVoice, musicRequest, suggestVoice, VOICES, voiceBackupRequest, voiceRequest, voiceStyle } from "@/lib/ai/media";
import { projectAspect } from "@/lib/aspect";
import { imageBackup, imageModel, imageRequest, type Aspect } from "@/lib/ai/images";
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

export const DEFAULT_PICTURE_MODEL = "nano-banana-pro";
// Models offered for actor sheets, outfits and keyframes: the ones best at real people.
export const PICTURE_MODELS = ["nano-banana-pro", "gpt-image-2", "seedream-5-pro", "nano-banana-2", "flux-2-pro"];

export type GenKind = "sheet" | "outfit" | "keyframe" | "clip" | "voice" | "music" | "voicetry" | "portrait" | "avatartry" | "product";
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

// A product that must look the same in every shot: its real photos (stored in our storage) and a
// one-line description of how it looks.
export type Product = { name: string; description?: string; photos?: string[] };
export type Lock = {
  locked?: boolean;
  consent?: boolean;
  narrator?: string;
  narratorStyle?: string;
  voices?: Record<string, string>;
  styles?: Record<string, string>;
  speaks?: Record<string, boolean>;
  // Per character: the dialect, the age the voice sounds, and the lip-sync model ("off" for none).
  dialects?: Record<string, string>;
  ages?: Record<string, string>;
  talkModels?: Record<string, string>;
  narratorDialect?: string;
  narratorAge?: string;
  // Optional parts left out on purpose: "narrator", "music", "products".
  skip?: string[];
  // Characters that use an actor saved in Libraries (character key: library id).
  libraryActors?: Record<string, string>;
  aspect?: string;
  imageModel?: string;
  products?: Product[];
};

export type Shot = { n: number; scene: string; size: string; angle: string; movement: string; lens: string; action: string; dialogue: string; seconds: number; cast: string[]; set: string; prompt: string };

export async function stageFive(supabase: SupabaseClient, projectId: string) {
  const { data: outs } = await supabase.from("outputs").select("id, number, status, current_version").eq("project_id", projectId).in("number", [9, 11, 13, 14, 15, 17, 34]);
  const withV = (outs ?? []).filter((o) => o.current_version > 0);
  const { data: versions } = withV.length ? await supabase.from("versions").select("output_id, version, content").in("output_id", withV.map((o) => o.id)) : { data: [] };
  const content = (n: number) => {
    const o = withV.find((x) => x.number === n);
    return o ? (versions?.find((v) => v.output_id === o.id && v.version === o.current_version)?.content as Record<string, unknown> | undefined) : undefined;
  };
  const written = ((content(13)?.characters as { name: string; role?: string; age?: string; look?: string; personality?: string; made_with?: string; library_id?: string | null; photos?: string[]; photo_consent?: boolean }[] | undefined) ?? []).filter((c) => c.name?.trim());
  // A character that reuses an actor saved in Libraries brings the saved sheet and voice.
  const libIds = written.map((c) => c.library_id).filter((x): x is string => Boolean(x && /^[0-9a-f-]{36}$/i.test(x)));
  const { data: saved } = libIds.length ? await supabase.from("characters").select("id, voice, image_paths").in("id", libIds) : { data: [] as { id: string; voice: string | null; image_paths: string[] | null }[] };
  const characters = written.map((c) => {
    const s = saved?.find((x) => x.id === c.library_id);
    return { ...c, libraryVoice: VOICES.find((v) => (s?.voice ?? "").startsWith(v.name))?.id, libraryImage: s?.image_paths?.[0] };
  });
  const wardrobe = (content(14)?.wardrobe as { character: string; scene: string; outfit: string }[] | undefined) ?? [];
  const locations = ((content(15)?.locations as { name: string; description?: string; int_ext?: string; library_id?: string | null }[] | undefined) ?? []).filter((l) => l.name?.trim());
  const shots = ((content(17)?.frames as Shot[] | undefined) ?? []).filter((f) => f.n);
  const script = (content(9)?.rows as { vo_ar?: string; vo_en?: string; seconds?: number }[] | undefined) ?? [];
  const mood = (content(11) ?? {}) as { look?: string; grade?: string; references?: string[] };
  const lock = (content(34) ?? {}) as Lock;
  // Outfits that really change between scenes need their own picture; one outfit is shown on the
  // sheet. A scene that says it keeps the same clothes ("same shirt as scene 1") is not a change.
  const same = /^\s*(the\s+)?same\b|^\s*(نفس|ذات)\s/i;
  const outfits = characters.filter((c) => c.made_with !== "cast").flatMap((c) => {
    const list = [...new Set(wardrobe.filter((w) => lookKey(w.character) === lookKey(c.name)).map((w) => w.outfit.trim()).filter((o) => o && !same.test(o)))];
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
  // Stable addresses, so the browser downloads each file once (see /media).
  for (const p of paths) urls.set(p, mediaUrl(p));
  const out: Record<string, { id: string; status: string; approved: boolean; model: string; prompt: string; url: string | null; version: number; seconds: number | null; cost: number | null; error: string | null; updatedAt: string; params: Record<string, unknown> }> = {};
  for (const [k, r] of latest) {
    const g = good.get(k);
    out[k] = { id: r.id, status: r.status, approved: Boolean(g?.approved), model: r.model, prompt: r.prompt, url: g?.path ? urls.get(g.path) ?? null : null, version: g?.version ?? 0, seconds: g?.seconds == null ? null : Number(g.seconds), cost: g?.cost_usd == null ? null : Number(g.cost_usd), error: r.error, updatedAt: r.updated_at, params: (r.params ?? {}) as Record<string, unknown> };
  }
  return out;
}

// Lines a character speaks on screen (not voiceover), one per shot, said by the first person in it.
export function dialogueLines(doc: { shots: Shot[] }) {
  return doc.shots
    .map((s) => ({ n: s.n, key: `dl-${s.n}`, speaker: s.cast?.[0] ?? "", text: (s.dialogue ?? "").replace(/^\s*["“”']|["“”']\s*$/g, "").trim() }))
    .filter((d) => d.speaker && d.text && !/^\s*(VO|V\.O\.|voiceover|تعليق)/i.test(d.text));
}

// The voice and the way of speaking for a character, or for the narrator (name null). What was
// picked in the reference lock, else a suggestion from the character and the project language.
// "how" is the short manner the person edits; "instruction" is everything Gemini reads.
export function voiceFor(doc: { characters: { name: string; role?: string; look?: string; personality?: string; age?: string; libraryVoice?: string }[]; lock: Lock }, name: string | null, language?: string | null, videoType?: string | null) {
  const female = (id: string) => VOICES.find((x) => x.id === id)?.gender === "f";
  if (!name) {
    const voice = isVoice(doc.lock.narrator) ? doc.lock.narrator! : suggestNarrator(videoType);
    const dialect = isDialect(doc.lock.narratorDialect) ? doc.lock.narratorDialect! : defaultDialect(language);
    const age = isAge(doc.lock.narratorAge) ? doc.lock.narratorAge! : "adult";
    const how = doc.lock.narratorStyle?.trim() || defaultHow(videoType, true);
    return { voice, how, dialect, age, suggested: !isVoice(doc.lock.narrator), suggestions: suggestVoices(null, videoType), instruction: voiceStyle({ female: female(voice), age, dialect, how, narrator: true }) };
  }
  const k = lookKey(name);
  const c = doc.characters.find((x) => lookKey(x.name) === k);
  const picked = doc.lock.voices?.[k];
  const voice = isVoice(picked) ? picked! : isVoice(c?.libraryVoice) ? c!.libraryVoice! : suggestVoice(c ?? { name }, videoType);
  const dialect = isDialect(doc.lock.dialects?.[k]) ? doc.lock.dialects![k] : defaultDialect(language);
  const age = isAge(doc.lock.ages?.[k]) ? doc.lock.ages![k] : guessAge(`${c?.age ?? ""} ${c?.role ?? ""}`);
  const how = doc.lock.styles?.[k]?.trim() || defaultHow(videoType);
  return { voice, how, dialect, age, suggested: !isVoice(picked) && !isVoice(c?.libraryVoice), suggestions: suggestVoices(c ?? { name }, videoType), instruction: voiceStyle({ female: female(voice), age, dialect, how }) };
}

// The lip-sync model for a character who speaks on camera, or null when lip sync is off.
export function talkModelFor(doc: { lock: Lock }, name: string) {
  const k = lookKey(name);
  const id = doc.lock.talkModels?.[k];
  if (id === "off" || doc.lock.speaks?.[k] === false) return null;
  return CLIP_MODELS.some((m) => m.id === id && m.talking) ? id! : DEFAULT_TALKING_MODEL;
}

// Whether a shot shows a product: it says so in its description.
const PRODUCT_WORDS = /(product|pack|packag|jar|bottle|tube|box|cream|serum|logo|can\b|cup|منتج|عبوة|علبة|كريم|زجاجة|العبوة|المنتج|الكريم)/i;
export function productsIn(doc: { lock: Lock }, s: { prompt?: string; action?: string }) {
  const text = `${s.prompt ?? ""} ${s.action ?? ""}`;
  if (doc.lock.skip?.includes("products")) return [];
  return (doc.lock.products ?? []).filter((p) => p.name?.trim() && (PRODUCT_WORDS.test(text) || text.toLowerCase().includes(p.name.toLowerCase())));
}

// The full instructions for one video shot: what we see, what happens, the camera, the product
// and what must stay the same. Written once here so the video model is never left guessing.
export function clipPromptFor(doc: { lock: Lock; characters: { name: string }[] }, s: Shot, language?: string | null, talking = false) {
  const products = productsIn(doc, s);
  const speaker = s.cast?.[0];
  const line = (s.dialogue ?? "").replace(/^\s*["“”']|["“”']\s*$/g, "").trim();
  const voiceover = /^\s*(VO|V\.O\.|voiceover|تعليق)/i.test(line);
  const camera = [s.size && `${s.size} shot`, s.angle, s.movement && `camera ${s.movement}`, s.lens && `${s.lens} lens`].filter(Boolean).join(", ");
  const parts = [
    s.prompt?.trim(),
    s.action?.trim() ? `What happens in this shot: ${s.action.trim()}` : "",
    camera ? `Camera: ${camera}.` : "",
    line && speaker && !voiceover ? (talking ? `${speaker} says this line to the camera with natural lip movement: "${line}".` : `${speaker} is speaking (${dialectFor(language)}); her or his lips move naturally, no subtitles.`) : "",
    ...products.map((p) => `The product is ${p.name}${p.description ? `: ${p.description}` : ""}. It must look exactly as in the first frame: same shape, colours and label.`),
    "Keep every face, hairstyle, outfit, product and the place exactly as in the first frame. Smooth, natural, realistic motion. No text, captions or watermarks on screen.",
  ];
  return parts.filter(Boolean).join("\n").slice(0, 2400);
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
  // A narrator left out on purpose does not hold up the voice step.
  const lockOut = (outs ?? []).find((o) => o.number === 34);
  const { data: lv } = lockOut?.current_version ? await admin.from("versions").select("content").eq("output_id", lockOut.id).eq("version", lockOut.current_version).maybeSingle() : { data: null };
  const skipped = ((lv?.content as { skip?: string[] } | null)?.skip ?? []);
  await Promise.all(
    [
      state(35, all(ready("keyframe")), generating("keyframe")),
      state(36, all(ready("clip")), generating("clip")),
      state(37, ready("voice").size > 0 || ready("music").size > 0 || skipped.includes("narrator"), generating("voice") || generating("music")),
      state(38, all(approved), false),
    ].filter(Boolean),
  );
}

// ---------- Running jobs ----------

export type GenRequest =
  | { kind: "sheet"; names: string[]; model?: string }
  | { kind: "outfit"; keys: string[]; model?: string }
  | { kind: "keyframe"; shots: number[]; model?: string; notes?: Record<string, string> }
  | { kind: "clip"; shots: number[]; model?: string; prompts?: Record<string, string>; auto?: boolean }
  | { kind: "voice"; keys: string[] }
  | { kind: "voicetry"; who: string | null }
  | { kind: "portrait"; who: string }
  | { kind: "product"; name: string }
  | { kind: "avatartry"; who: string }
  | { kind: "music" };

export async function runGenerate(projectId: string, req: GenRequest, emit: (e: GenEvent) => void, signal?: AbortSignal) {
  const { me, supabase, project } = await loadProject(projectId);
  const { t } = await getI18n();
  if (project.current_stage !== 5) throw new Error(t.project.notCurrentStage);
  const g = t.generate;
  const admin = createAdminClient();
  const doc = await stageFive(supabase, projectId);
  const brief = (project.brief ?? {}) as { language?: string; feeling?: string; formats?: unknown; platforms?: unknown; product?: string; video_type?: string };
  // The frame shape: picked in the reference lock, else from the brief (Instagram means 9:16).
  const aspect: Aspect = projectAspect(doc.lock.aspect, brief);
  // Sheets, outfits and keyframes use the picture model picked in the reference lock; by default
  // the strongest model for keeping faces the same.
  const imgModel = imageModel(("model" in req && req.model) || doc.lock.imageModel || DEFAULT_PICTURE_MODEL).id;
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
      // Photos of the real person this character is based on, uploaded with consent in stage 3.
      const saved = c.libraryImage?.startsWith(`${project.workspace_id}/library/`) ? await sign(c.libraryImage) : null;
      const own = saved ? [saved] : c.photo_consent ? (await Promise.all((c.photos ?? []).filter((p) => p.startsWith(`${project.workspace_id}/projects/${projectId}/`)).slice(0, 2).map((p) => sign(p)))).filter((u): u is string => Boolean(u)) : [];
      const outfit = doc.wardrobe.find((w) => lookKey(w.character) === lookKey(c.name))?.outfit;
      const prompt = `Digital actor reference sheet for a film, all in one image: ${c.name}${c.role ? `, ${c.role}` : ""}. Age: ${c.age ?? ""}. ${c.look ?? ""}${outfit ? ` Wearing: ${outfit}.` : ""} Left: full body from the front. Middle: full body from the side. Right: four head-and-shoulders close-ups with the expressions neutral, smiling, serious and surprised. Plain light grey studio background, even soft light. No words, titles or labels anywhere in the image.${ref ? " Keep the face exactly as in the reference photo." : ""}\n\n${PHOTO}`;
      jobs.push(imageJob(lookKey(c.name), c.name, `${prompt}${own.length ? `\nThe last ${own.length === 1 ? "image is a photo" : `${own.length} images are photos`} of the real person: keep this exact face.` : ""}`, [...(ref ? [ref] : []), ...own], "16:9"));
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
    // The approved storyboard frame gives the framing; the actor sheet, the location picture and
    // the product photos give the faces, the place and the product.
    const { data: drawn } = await supabase.from("frame_images").select("n, path, version").eq("project_id", projectId).eq("status", "ready").order("version", { ascending: false });
    for (const s of doc.shots.filter((x) => req.shots.includes(x.n))) {
      const refs: string[] = [];
      const roles: string[] = [];
      const add = (u: string | null, role: string) => {
        if (u && refs.length < 6) {
          refs.push(u);
          roles.push(`Image ${refs.length}: ${role}`);
        }
      };
      add(await sign(drawn?.find((f) => f.n === s.n)?.path), `the approved storyboard frame. Follow its framing, composition and the position of people and objects, adapted to a ${aspect} frame. Do not copy its drawing style.`);
      for (const name of s.cast ?? []) {
        const outfit = doc.wardrobe.find((w) => lookKey(w.character) === lookKey(name) && (w.scene === s.scene || w.scene.includes(s.scene)))?.outfit;
        const p = (outfit && (await assetPath("outfit", `${lookKey(name)}|${lookKey(outfit)}`.slice(0, 200)))) || (await assetPath("sheet", lookKey(name))) || lookPath("character", name);
        add(await sign(p), `${name}. Keep this exact face, hair, body and clothes.`);
      }
      if (s.set) add(await sign(lookPath("location", s.set)), `the place, ${s.set}. Keep it exactly.`);
      const products = productsIn(doc, s);
      for (const p of products) {
        for (const photo of (p.photos ?? []).slice(0, 2)) add(await sign(photo), `the real product, ${p.name}. Show exactly this product: same shape, colours, cap and label.`);
        // The product picture made by AI: the only reference when there are no photos.
        if ((p.photos ?? []).length < 2) add(await sign(await assetPath("product", lookKey(p.name))), `the product, ${p.name}. Show exactly this product: same shape, colours, cap and label.`);
      }
      const productText = products.map((p) => `The product is ${p.name}${p.description ? `: ${p.description}` : ""}.`).join(" ");
      const note = req.notes?.[String(s.n)]?.trim();
      const prompt = `Final film frame, ${aspect}. ${s.prompt}${note ? `\nChange asked by the producer: ${note}` : ""}${productText ? `\n${productText}` : ""}${roles.length ? `\nReference images:\n${roles.join("\n")}` : ""}\n\n${PHOTO}`.slice(0, 5900);
      jobs.push(imageJob(String(s.n), fill(g.shot, { n: s.n }), prompt, refs, aspect));
    }
  } else if (req.kind === "clip") {
    const picked = clipModel(req.model ?? DEFAULT_CLIP_MODEL).id;
    const lines = new Map(dialogueLines(doc).map((d) => [d.n, d]));
    for (const s of doc.shots.filter((x) => req.shots.includes(x.n))) {
      const kf = await sign(await assetPath("keyframe", String(s.n)));
      if (!kf) {
        emit({ t: "genFailed", label: fill(g.shot, { n: s.n }), reason: g.keyframeFirst });
        continue;
      }
      // A shot where a character speaks on camera uses the talking model with her voice line,
      // unless someone picked a model for it by hand.
      const line = lines.get(s.n);
      const talker = line ? talkModelFor(doc, line.speaker) : null;
      const lineAudio = talker ? await sign(await assetPath("voice", `dl-${s.n}`)) : null;
      const model = clipModel(picked).talking ? picked : req.auto !== false && lineAudio && talker ? talker : picked;
      const talking = Boolean(clipModel(model).talking);
      const audio = talking ? lineAudio ?? (await sign(await assetPath("voice", `dl-${s.n}`))) : null;
      if (talking && !audio) {
        emit({ t: "genFailed", label: fill(g.shot, { n: s.n }), reason: g.dialogueFirst });
        continue;
      }
      const prompt = (req.prompts?.[String(s.n)]?.trim() || clipPromptFor(doc, s, brief.language, talking)).slice(0, 2400);
      jobs.push({
        key: String(s.n), label: fill(g.shot, { n: s.n }), model, prompt, params: { seconds: s.seconds, aspect, talking }, seconds: clipSeconds(model, s.seconds),
        build: (m) => clipRequest(m, prompt, kf, s.seconds, aspect, audio), backup: clipBackup, modelName: (id) => clipModel(id).name,
      });
    }
  } else if (req.kind === "portrait") {
    // The talking picture: the character looking at the camera, chest up, in the project's frame
    // shape and in the place of her first speaking shot. Lip-sync models animate this picture.
    const c = doc.characters.find((x) => lookKey(x.name) === lookKey(req.who));
    if (!c) throw new Error(g.nothing);
    const first = doc.shots.find((s) => s.dialogue?.trim() && lookKey(s.cast?.[0] ?? "") === lookKey(c.name));
    const refs: string[] = [];
    const face = (await sign(await assetPath("sheet", lookKey(c.name)))) ?? (await sign(lookPath("character", c.name)));
    if (face) refs.push(face);
    const place = first?.set ? await sign(lookPath("location", first.set)) : null;
    if (place) refs.push(place);
    const prompt = `${c.name}, chest-up portrait looking straight into the camera, about to speak, natural relaxed expression, mouth closed, face well lit and sharp, ${aspect} frame.${first?.set ? ` Background: ${first.set}, softly out of focus.` : " Soft, plain background."}${face ? " Keep the face, hair and clothes exactly as in image 1." : ""}${place ? " Image 2 is the place." : ""} One person only. No words or labels.\n\n${PHOTO}`;
    jobs.push(imageJob(lookKey(c.name), c.name, prompt, refs, aspect));
  } else if (req.kind === "product") {
    // A clean product picture: from the real photos when there are some, else designed from the
    // description (for ideas that do not exist yet). Keyframes then show this exact product.
    if (doc.lock.locked) throw new Error(g.lockedNote);
    const p = (doc.lock.products ?? (brief.product ? [{ name: String(brief.product) }] : [])).find((x) => lookKey(x.name) === lookKey(req.name));
    if (!p?.name?.trim()) throw new Error(g.nothing);
    const refs = (await Promise.all((p.photos ?? []).slice(0, 4).map((x) => sign(x)))).filter((x): x is string => Boolean(x));
    const prompt = refs.length
      ? `Professional studio product photo of ${p.name}${p.description ? `: ${p.description}` : ""}. Exactly the product in the reference photos: same shape, colours, cap, label and text. Centered, front view, clean light background, soft natural shadow, sharp focus, true colours. No hands, no extra objects, no added words.\n\n${PHOTO}`
      : `Design a realistic product for an advert: ${p.name}${p.description ? `: ${p.description}` : ""}. Professional studio product photo, centered, front view, clean light background, soft natural shadow, sharp focus. Make the pack, colours and label clear and believable. No hands, no extra objects.\n\n${PHOTO}`;
    jobs.push(imageJob(lookKey(p.name), p.name, prompt, refs, "1:1"));
  } else if (req.kind === "avatartry") {
    // A short lip-sync test: the talking picture says the voice try line.
    const name = req.who;
    const model = talkModelFor(doc, name) ?? DEFAULT_TALKING_MODEL;
    const pic = await sign(await assetPath("portrait", lookKey(name)));
    const audio = await sign(await assetPath("voicetry", `try-${lookKey(name)}`.slice(0, 200)));
    if (!pic || !audio) throw new Error(g.avatarFirst);
    const text = dialogueLines(doc).find((d) => lookKey(d.speaker) === lookKey(name))?.text ?? "";
    const secs = Math.max(3, Math.min(15, Math.round(text.length / 14) || 5));
    const prompt = `${name} talks to the camera naturally, with small head movements and natural blinking. Lips match the audio exactly.`;
    jobs.push({
      key: lookKey(name), label: name, model, prompt, params: { talking: true }, seconds: secs,
      build: (m) => clipRequest(m, prompt, pic, secs, aspect, audio), backup: clipBackup, modelName: (id) => clipModel(id).name,
    });
  } else if (req.kind === "voice" || req.kind === "voicetry") {
    const voiceJob = (key: string, label: string, text: string, who: string | null): Job => {
      const v = voiceFor(doc, who, brief.language, brief.video_type);
      return {
        key, label, model: "gemini-3-8-tts", prompt: text, params: { voice: v.voice, style: v.instruction, speaker: who },
        build: (m) => (m === "elevenlabs" ? voiceBackupRequest(text, v.voice) : voiceRequest(text, v.voice, v.instruction)),
        backup: () => "elevenlabs", modelName: (id) => (id === "elevenlabs" ? "ElevenLabs" : `Gemini 3.8 voice (${v.voice})`),
      };
    };
    const voLines = scriptLines(doc, brief.language);
    if (req.kind === "voicetry") {
      // A short try of a voice: the character's first line, or the narrator's first line.
      const who = req.who;
      const text = (who ? dialogueLines(doc).find((d) => lookKey(d.speaker) === lookKey(who))?.text : voLines[0]?.text) || (/(arab|عرب|saudi|سعود)/i.test(brief.language ?? "") ? "هلا والله، هذا صوتي. وش رايكم فيه؟" : "Hello, this is my voice. What do you think?");
      jobs.push(voiceJob(`try-${who ? lookKey(who) : "narrator"}`.slice(0, 200), who ?? g.narrator, text.slice(0, 300), who));
    } else {
      for (const l of voLines) if (req.keys.includes(l.key)) jobs.push(voiceJob(l.key, fill(g.line, { n: l.n }), l.text, null));
      // Dialogue spoken in a shot, in the speaker's own voice.
      for (const d of dialogueLines(doc)) if (req.keys.includes(d.key)) jobs.push(voiceJob(d.key, fill(g.dialogue, { n: d.n, name: d.speaker }), d.text, d.speaker));
    }
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
  const atOnce = kind === "voice" || kind === "voicetry" ? 4 : 3;
  await Promise.all(Array.from({ length: Math.min(atOnce, queue.length) }, async () => { while (queue.length) await runJob(queue.shift()!); }));
  await syncOutputs(admin, projectId);

  if (accountProblem) {
    await notify({ workspaceId: project.workspace_id, projectId, kind: "ai_failed", title: "Kie.ai stopped the generation", body: accountProblem });
    throw new Error(t.project.frames.accountProblem);
  }
  if (failed && !signal?.aborted) await notify({ workspaceId: project.workspace_id, projectId, kind: "ai_failed", title: `${failed} generation${failed > 1 ? "s" : ""} failed`, body: "Nothing was charged for them. Try them again." });
}

// The voiceover lines of the script, in the project language.
export function scriptLines(doc: { script: { vo_ar?: string; vo_en?: string }[] }, language?: string | null) {
  const arabic = /(arab|عرب|saudi|سعود)/i.test(language ?? "");
  return doc.script
    .map((row, i) => ({ n: i + 1, key: `vo-${i + 1}`, text: ((arabic ? row.vo_ar || row.vo_en : row.vo_en || row.vo_ar) ?? "").replace(/^\s*(VO|V\.O\.)\s*:\s*/i, "").trim() }))
    .filter((l) => l.text);
}

function fill(s: string, v: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
}
