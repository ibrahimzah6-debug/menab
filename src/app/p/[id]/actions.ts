"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { IMAGE_MODELS, TEXT_MODELS } from "@/lib/ai/catalog";
import { runStageOne } from "@/lib/stage-one-run";
import { transcribe } from "@/lib/ai/transcribe";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, notify, saveVersion, STAGE_OUTPUTS, type Path } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember, getMemberships } from "@/lib/workspace";
import { hiddenOutputs, videoType } from "@/lib/video-types";
import { stageFive, syncOutputs } from "@/lib/generate";
import { missingPictures } from "@/lib/frames";
import { fill } from "@/lib/i18n/dictionaries";
import { VOICES } from "@/lib/ai/media";
import { FILE_TYPES, loadProject, ownPath, runBriefMessage, type BriefPayload } from "@/lib/brief-turn";

export type Result = { error?: string };

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

// ---------- Create ----------

// Starting briefs for the templates (mvp-definition.md: Commercial with Ramadan ad, product
// launch and event recap). The brief chat continues from here.
const PRESETS = {
  ramadan: { length_seconds: 30, cutdowns: ["15 sec", "6 sec"], formats: ["16:9 TV and YouTube", "9:16 Instagram and TikTok"], real_products: "unknown", real_people: "unknown", feeling: { en: "Warm, emotional, family", ar: "دافئ وعاطفي وعائلي" }, objective: { en: "A Ramadan brand film that ties the brand to family moments", ar: "فيلم رمضاني يربط العلامة بلحظات العيلة" } },
  launch: { length_seconds: 30, cutdowns: ["15 sec", "6 sec"], formats: ["16:9 YouTube", "9:16 Instagram and TikTok", "1:1 feed"], real_products: "yes", real_people: "unknown", feeling: null, objective: { en: "Launch a new product: what it is, what it does and why now", ar: "إطلاق منتج جديد: وش هو ووش يسوي وليش الحين" } },
  event: { length_seconds: 60, cutdowns: ["15 sec teaser"], formats: ["16:9 YouTube", "9:16 Instagram and TikTok"], real_products: "unknown", real_people: "yes", feeling: { en: "Energetic, cut to music", ar: "حماسي ومقطّع على الموسيقى" }, objective: { en: "Recap the best moments of an event", ar: "ملخص لأحلى لحظات الفعالية" } },
} as const;
type Preset = keyof typeof PRESETS;

export async function createProject(form?: FormData) {
  const me = await getCurrentMember();
  if (!me || !["admin", "producer"].includes(me.role)) redirect("/projects");
  const { t, locale } = await getI18n();
  const asked = form?.get("preset");
  const preset = typeof asked === "string" && asked in PRESETS ? (asked as Preset) : null;
  const supabase = await createClient();
  const p = preset ? PRESETS[preset] : null;
  const brief = p
    ? {
        project_name: t.templates.preset[preset!].name,
        objective: p.objective[locale],
        feeling: p.feeling ? p.feeling[locale] : null,
        length_seconds: p.length_seconds,
        cutdowns: [...p.cutdowns],
        formats: [...p.formats],
        real_products: p.real_products,
        real_people: p.real_people,
        story: [],
        must_show: [],
        references: [],
        locations: [],
      }
    : undefined;
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ workspace_id: me.workspace.id, name: preset ? t.templates.preset[preset].name : t.project.untitled, created_by: me.userId, ...(brief ? { brief } : {}) })
    .select("id")
    .single();
  if (error || !project) redirect("/projects?error=create");

  await supabase.from("stages").insert(
    [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      workspace_id: me.workspace.id,
      project_id: project.id,
      number: n,
      status: n === 1 ? "active" : "locked",
    })),
  );
  await supabase.from("outputs").insert(
    STAGE_OUTPUTS[1].map((n) => ({ workspace_id: me.workspace.id, project_id: project.id, stage: 1, number: n })),
  );
  if (preset) {
    await supabase.from("messages").insert({
      workspace_id: me.workspace.id,
      project_id: project.id,
      role: "assistant",
      content: t.templates.preset[preset].opening,
      created_by: me.userId,
    });
  }
  redirect(`/p/${project.id}`);
}

// ---------- Brief chat ----------


export async function chooseTextModel(projectId: string, modelId: string): Promise<Result> {
  if (!TEXT_MODELS.some((m) => m.id === modelId)) return { error: "Unknown model" };
  try {
    const { supabase, project } = await loadProject(projectId);
    const models = { ...((project.models ?? {}) as Record<string, string>), text: modelId };
    await supabase.from("projects").update({ models }).eq("id", projectId);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

const MAX_FILE = 10 * 1024 * 1024;
const MAX_VOICE = 20 * 1024 * 1024;

// Files and voice notes go straight from the browser to Menab's storage with a one-time
// upload link, so their size never passes through the app server.
export async function prepareUpload(
  projectId: string,
  kind: "file" | "voice",
  name: string,
  mime: string,
  size: number,
): Promise<{ path?: string; token?: string; error?: string }> {
  if (kind === "file" && !FILE_TYPES.includes(mime)) return { error: "Attach images (PNG, JPG, WEBP) or PDFs." };
  if (kind === "file" && size > MAX_FILE) return { error: "Each file must be under 10 MB." };
  if (kind === "voice" && (mime !== "audio/wav" || size > MAX_VOICE)) return { error: "That recording is too long. Keep voice notes under 5 minutes." };
  try {
    const { me } = await loadProject(projectId);
    const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "file";
    const path = `${me.workspace.id}/projects/${projectId}/${kind === "voice" ? "voice" : "files"}/${Date.now()}-${safe}`;
    const { data, error } = await createAdminClient().storage.from("media").createSignedUploadUrl(path);
    if (error || !data) return { error: "Could not start the upload. Try again." };
    return { path: data.path, token: data.token };
  } catch (e) {
    return { error: errText(e) };
  }
}


// Turns a recorded voice note into text with Gemini. The text goes into the reply box first,
// so the person can read it and decide to send it.
export async function transcribeVoice(projectId: string, path: string): Promise<{ text?: string; error?: string }> {
  const { t } = await getI18n();
  try {
    const { me } = await loadProject(projectId);
    if (!ownPath(path, me.workspace.id, projectId)) return { error: "Recording not found." };
    const { data: file } = await createAdminClient().storage.from("media").download(path);
    if (!file) return { error: "Recording not found." };
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const r = await transcribe(buf, "audio/wav");
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "transcribe", provider: r.provider, model: r.model, ok: true, usage: r.usage });
      return { text: r.text };
    } catch (e) {
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "transcribe", provider: "google", model: "gemini-3.5-transcribe", ok: false, error: errText(e) });
      await notify({ workspaceId: me.workspace.id, projectId, kind: "ai_failed", title: "A voice note could not be turned into text", body: errText(e) });
      return { error: t.project.voiceFailed };
    }
  } catch (e) {
    return { error: errText(e) };
  }
}

// A brief message without live steps (the chat uses /p/[id]/brief, which reports each step).
export async function sendBriefMessage(projectId: string, payload: BriefPayload): Promise<Result> {
  try {
    await runBriefMessage(projectId, payload, () => {});
  } catch (e) {
    revalidatePath(`/p/${projectId}`);
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

export async function choosePath(projectId: string, path: Path): Promise<Result> {
  if (!["ai", "production", "hybrid"].includes(path)) return { error: "Unknown path" };
  try {
    const { supabase, project } = await loadProject(projectId);
    // The path decides which stages follow, so it is fixed once stage 1 is approved.
    if (project.current_stage !== 1) return { error: "The path is fixed once the brief is approved." };
    await supabase.from("projects").update({ path, updated_at: new Date().toISOString() }).eq("id", projectId);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

export async function renameProject(projectId: string, name: string): Promise<Result> {
  const clean = name.trim().slice(0, 160);
  if (!clean) return {};
  try {
    const { supabase } = await loadProject(projectId);
    await supabase.from("projects").update({ name: clean }).eq("id", projectId);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// ---------- Stage 1 documents ----------

// The stage 1 documents without live steps (the page uses /p/[id]/documents, which streams them).
export async function writeBriefDocuments(projectId: string, instruction?: string): Promise<Result> {
  try {
    await runStageOne(projectId, instruction, () => {});
  } catch (e) {
    revalidatePath(`/p/${projectId}`);
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// ---------- Approval ----------

export async function approveStage(projectId: string, stage: number): Promise<Result> {
  const { t } = await getI18n();
  try {
    const { me, supabase, project } = await loadProject(projectId);
    if (stage !== project.current_stage) return { error: t.project.notCurrentStage };
    const { data: outs } = await supabase
      .from("outputs")
      .select("number, status")
      .eq("project_id", projectId)
      .eq("stage", stage);
    // Steps the video type does not need are not waited for.
    const hidden = hiddenOutputs(project.brief as { video_type?: string; real_people?: string });
    const needed = stage === 1 ? [3, 4, 5, 6] : (outs ?? []).map((o) => o.number).filter((n) => !hidden.has(n));
    const ready = (outs ?? []).filter((o) => ["ready", "edited", "approved"].includes(o.status)).map((o) => o.number);
    if (!needed.every((n) => ready.includes(n))) return { error: t.project.notReady };
    if (stage === 1 && !project.path) return { error: t.project.choosePathFirst };
    // M4: every shot in the storyboard has a drawn frame.
    // M5: the references are locked and every shot's clip is approved.
    if (stage === 5) {
      const doc = await stageFive(supabase, projectId);
      if (!doc.lock.locked) return { error: t.generate.lockFirst };
      const { data: clips } = await supabase.from("gen_assets").select("key").eq("project_id", projectId).eq("kind", "clip").eq("status", "ready").eq("approved", true);
      const ok = new Set((clips ?? []).map((c) => c.key));
      if (!doc.shots.length || !doc.shots.every((s) => ok.has(String(s.n)))) return { error: t.project.notReady };
    }
    if (stage === 3 && !hidden.has(17)) {
      const { data: sb } = await supabase.from("outputs").select("id, current_version").eq("project_id", projectId).eq("number", 17).maybeSingle();
      const { data: v } = sb ? await supabase.from("versions").select("content").eq("output_id", sb.id).eq("version", sb.current_version).maybeSingle() : { data: null };
      const frames = ((v?.content as { frames?: { n: number }[] } | null)?.frames ?? []).map((f) => f.n);
      const { data: drawn } = await supabase.from("frame_images").select("n").eq("project_id", projectId).eq("status", "ready");
      const have = new Set((drawn ?? []).map((d) => d.n));
      if (!frames.length || !frames.every((n) => have.has(n))) return { error: t.project.frames.missing };
    }
    // Every AI character and AI location has its picture before the look is approved.
    if (stage === 3) {
      const waiting = await missingPictures(supabase, projectId);
      if (waiting.length) return { error: fill(t.project.frames.picturesMissing, { names: waiting.join(", ") }) };
    }

    const now = new Date().toISOString();
    // A reopened stage approved again with changes: later documents were made before the change.
    const { data: thisStage, error: stageError } = await supabase.from("stages").select("reopened_at").eq("project_id", projectId).eq("number", stage).maybeSingle();
    if (stageError) throw new Error(stageError.message);
    if (thisStage?.reopened_at) {
      if (await changedSince(supabase, projectId, stage, thisStage.reopened_at)) {
        const { error } = await supabase.from("outputs").update({ stale_from: stage }).eq("project_id", projectId).gt("stage", stage);
        if (error) throw new Error(error.message);
      }
    }
    await supabase.from("outputs").update({ status: "approved", updated_at: now }).eq("project_id", projectId).eq("stage", stage);
    await supabase.from("stages").update({ status: "approved", approved_by: me.userId, approved_at: now, reopened_at: null }).eq("project_id", projectId).eq("number", stage);

    // The next stage that applies to the path.
    const order = project.path === "ai" ? [1, 2, 3, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7];
    const next = order[order.indexOf(stage) + 1];
    if (next) {
      await supabase.from("stages").update({ status: "active" }).eq("project_id", projectId).eq("number", next);
      // After a reopen the next stage may already have its documents: they open for editing again.
      const nums = STAGE_OUTPUTS[next] ?? [];
      const { data: existing } = await supabase.from("outputs").select("number").eq("project_id", projectId).eq("stage", next);
      const have = new Set((existing ?? []).map((x) => x.number));
      const add = nums.filter((n) => !have.has(n));
      if (add.length) {
        await supabase
          .from("outputs")
          .insert(add.map((n) => ({ workspace_id: me.workspace.id, project_id: projectId, stage: next, number: n })));
      }
      if (have.size) await supabase.from("outputs").update({ status: "ready" }).eq("project_id", projectId).eq("stage", next).eq("status", "approved");
      await supabase.from("projects").update({ current_stage: next, updated_at: now }).eq("id", projectId);
    }
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// Reopens an approved stage (Admins and Producers). The project goes back to that stage; nothing
// made in later stages is deleted. Approving it again moves the project forward, and if anything
// changed, the later documents are marked as made before the change.
export async function reopenStage(projectId: string, stage: number): Promise<Result> {
  const { t } = await getI18n();
  try {
    const { me, supabase, project } = await loadProject(projectId);
    if (!["admin", "producer"].includes(me.role)) return { error: t.stage.reopenRole };
    if (stage >= project.current_stage) return { error: t.project.notCurrentStage };
    if (project.current_stage === stage) return {};
    const { data: s } = await supabase.from("stages").select("status").eq("project_id", projectId).eq("number", stage).maybeSingle();
    if (s?.status !== "approved") return { error: t.project.notCurrentStage };
    // Nothing is reopened while Menab is still writing or making something.
    const { count } = await supabase.from("outputs").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "generating");
    if (count) return { error: t.project.alreadyWriting };
    const now = new Date().toISOString();
    // Each step must succeed: a half-reopened project would be stuck between two stages.
    const must = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };
    must(await supabase.from("stages").update({ status: "active", approved_by: null, approved_at: null, reopened_at: now }).eq("project_id", projectId).eq("number", stage));
    must(await supabase.from("stages").update({ status: "locked" }).eq("project_id", projectId).gt("number", stage).in("status", ["active", "approved"]));
    must(await supabase.from("outputs").update({ status: "ready", updated_at: now }).eq("project_id", projectId).eq("stage", stage).eq("status", "approved"));
    must(await supabase.from("projects").update({ current_stage: stage, updated_at: now }).eq("id", projectId));
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// Whether a stage's work changed after a time: a new version of one of its documents, or, for
// stage 3, a new picture or storyboard frame.
async function changedSince(supabase: Awaited<ReturnType<typeof loadProject>>["supabase"], projectId: string, stage: number, since: string) {
  const { data: outs } = await supabase.from("outputs").select("id").eq("project_id", projectId).eq("stage", stage);
  const ids = (outs ?? []).map((o) => o.id);
  if (ids.length) {
    const { count } = await supabase.from("versions").select("id", { count: "exact", head: true }).in("output_id", ids).gt("created_at", since);
    if (count) return true;
  }
  if (stage === 3) {
    const [{ count: a }, { count: b }] = await Promise.all([
      supabase.from("look_images").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "ready").gt("created_at", since),
      supabase.from("frame_images").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "ready").gt("created_at", since),
    ]);
    if (a || b) return true;
  }
  return false;
}

// ---------- Edits by people ----------

// Saves a person's edit as a new version. The earlier version is kept and can be restored.
// Which outputs a person can edit by hand, per stage (approved stages are read only).
const EDITABLE: Record<number, number[]> = { 1: [3, 4, 5, 6], 2: [7, 9, 10, 11], 3: [13, 14, 15, 16, 17, 18], 4: [20, 22, 25, 26, 28, 31, 32] };

export async function saveOutputEdit(projectId: string, number: number, content: unknown): Promise<Result> {
  try {
    const { me, supabase, project } = await loadProject(projectId);
    if (!(EDITABLE[project.current_stage] ?? []).includes(number)) return { error: "This step can't be edited now. Approved work changes only with a new version." };
    const { data: o } = await supabase
      .from("outputs")
      .select("id, workspace_id, current_version")
      .eq("project_id", projectId)
      .eq("number", number)
      .maybeSingle();
    if (!o) return { error: "Step not found." };
    await saveVersion(supabase, o, content, "edit", me.userId, null);
    // The PPM meeting is done only when the client signed off.
    if (number === 28 && !(content as { signed?: boolean } | null)?.signed) await supabase.from("outputs").update({ status: "waiting" }).eq("id", o.id);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// The creative meeting (output 8): the chosen direction and the notes.
export async function chooseDirection(projectId: string, chosen: number, notes: string): Promise<Result> {
  try {
    const { me, supabase, project } = await loadProject(projectId);
    if (project.current_stage !== 2) return { error: "This stage is not open." };
    const { data: o } = await supabase.from("outputs").select("id, workspace_id, current_version").eq("project_id", projectId).eq("number", 8).maybeSingle();
    if (!o) return { error: "Step not found." };
    await saveVersion(supabase, o, { chosen: Math.max(0, Math.min(2, Math.round(chosen))), notes: notes.trim().slice(0, 4000) }, "edit", me.userId, null, "ready");
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// Any earlier version comes back as a new version, so nothing is ever lost (M3, Versions).
export async function restoreVersion(projectId: string, number: number, version: number): Promise<Result> {
  try {
    const { me, supabase, project } = await loadProject(projectId);
    if (!(EDITABLE[project.current_stage] ?? []).includes(number) && number !== 8) return { error: "Approved work changes only with a new version." };
    const { data: o } = await supabase.from("outputs").select("id, workspace_id, current_version").eq("project_id", projectId).eq("number", number).maybeSingle();
    if (!o) return { error: "Step not found." };
    const { data: v } = await supabase.from("versions").select("content").eq("output_id", o.id).eq("version", version).maybeSingle();
    if (!v) return { error: "Version not found." };
    await saveVersion(supabase, o, v.content, "restore", me.userId, null, "edited");
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// The idea and story beats on the brief panel can be edited directly.
export async function saveBriefIdea(projectId: string, logline: string, story: string[]): Promise<Result> {
  try {
    const { me, supabase, project } = await loadProject(projectId);
    // The brief is approved with stage 1; after that it changes only with a new version.
    if (project.current_stage !== 1) return { error: "The brief is approved. It can't be changed here." };
    const brief = {
      ...((project.brief ?? {}) as Record<string, unknown>),
      logline: logline.trim().slice(0, 600) || null,
      story: story.map((x) => x.trim()).filter(Boolean).slice(0, 12).map((x) => x.slice(0, 300)),
    };
    await supabase.from("projects").update({ brief, updated_at: new Date().toISOString() }).eq("id", projectId);
    const { data: o } = await supabase
      .from("outputs")
      .select("id, workspace_id, current_version")
      .eq("project_id", projectId)
      .eq("number", 1)
      .maybeSingle();
    if (o) await saveVersion(supabase, o, { brief }, "edit", me.userId, null);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// Deletes a project for good: its stages, chat, documents, versions and stored files. Its AI
// costs stay in the log (Credits), with the project link cleared. Admins and Producers only.
export async function deleteProject(projectId: string): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data: project } = await supabase.from("projects").select("id, workspace_id").eq("id", projectId).maybeSingle();
    if (!project) return { error: "Project not found." };
    const me = (await getMemberships()).find((m) => m.workspace.id === project.workspace_id);
    if (!me || !["admin", "producer"].includes(me.role)) return { error: "Only an Admin or a Producer can delete a project." };
    const admin = createAdminClient();
    const base = `${project.workspace_id}/projects/${projectId}`;
    for (const folder of ["files", "voice"]) {
      const { data: list } = await admin.storage.from("media").list(`${base}/${folder}`, { limit: 1000 });
      const paths = (list ?? []).map((f) => `${base}/${folder}/${f.name}`);
      if (paths.length) await admin.storage.from("media").remove(paths);
    }
    const { error } = await admin.from("projects").delete().eq("id", projectId).eq("workspace_id", project.workspace_id);
    if (error) return { error: "Could not delete the project. Try again." };
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath("/projects");
  revalidatePath("/");
  redirect("/projects");
}

// The video type, picked by the person. Menab keeps this choice from then on.
export async function chooseVideoType(projectId: string, typeId: string): Promise<Result> {
  if (!videoType(typeId) || videoType(typeId)?.soon) return { error: "Unknown video type" };
  try {
    const { supabase, project } = await loadProject(projectId);
    const brief = { ...((project.brief ?? {}) as Record<string, unknown>), video_type: typeId, video_type_by: "person" };
    await supabase.from("projects").update({ brief, updated_at: new Date().toISOString() }).eq("id", projectId);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// ---------- Stage 5, Generate ----------

// The reference lock (output 34): voices, frame shape, consent, and the lock itself. Once
// locked, every keyframe and clip follows these references.
export async function saveReferenceLock(projectId: string, patch: { narrator?: string; voices?: Record<string, string>; aspect?: string; consent?: boolean; locked?: boolean; imageModel?: string }): Promise<Result> {
  const { t } = await getI18n();
  try {
    const { me, supabase, project } = await loadProject(projectId);
    if (project.current_stage !== 5) return { error: t.project.notCurrentStage };
    const { data: o } = await supabase.from("outputs").select("id, workspace_id, current_version").eq("project_id", projectId).eq("number", 34).maybeSingle();
    if (!o) return { error: "Step not found." };
    const { data: v } = o.current_version ? await supabase.from("versions").select("content").eq("output_id", o.id).eq("version", o.current_version).maybeSingle() : { data: null };
    const current = (v?.content ?? {}) as Record<string, unknown>;
    // The picture model can change after the lock: it applies to the next pictures, like keyframes.
    const onlyModel = Object.keys(patch).every((k) => k === "imageModel");
    if (patch.imageModel && !IMAGE_MODELS.some((m) => m.id === patch.imageModel)) return { error: "Unknown model." };
    if (current.locked && !onlyModel && patch.locked !== false && patch.locked !== true) return { error: t.generate.lockedNote };
    const next = { ...current, ...patch, voices: { ...((current.voices as object) ?? {}), ...(patch.voices ?? {}) } };
    if (patch.locked) {
      // Real people's photos need their written consent first (B27).
      const doc = await stageFive(supabase, projectId);
      if (doc.characters.some((c) => c.library_id) && !next.consent) return { error: t.generate.consentFirst };
    }
    await saveVersion(supabase, o, next, "edit", me.userId, null, next.locked ? "ready" : "edited");
    // The step is done only when locked.
    if (!next.locked) await supabase.from("outputs").update({ status: "waiting" }).eq("id", o.id);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// Shot review (output 38): approve or reopen the newest clip of a shot.
export async function approveClip(projectId: string, n: number, approved: boolean): Promise<Result> {
  const { t } = await getI18n();
  try {
    const { supabase, project } = await loadProject(projectId);
    if (project.current_stage !== 5) return { error: t.project.notCurrentStage };
    const { data: rows } = await supabase.from("gen_assets").select("id").eq("project_id", projectId).eq("kind", "clip").eq("key", String(n)).eq("status", "ready").order("version", { ascending: false }).limit(1);
    if (!rows?.length) return { error: t.generate.noClip };
    const admin = createAdminClient();
    await admin.from("gen_assets").update({ approved: false }).eq("project_id", projectId).eq("kind", "clip").eq("key", String(n));
    if (approved) await admin.from("gen_assets").update({ approved: true, updated_at: new Date().toISOString() }).eq("id", rows[0].id);
    await syncOutputs(admin, projectId);
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// Saves a digital actor (its sheet, stage 3 picture, outfit pictures, look and voice) to the
// company's Libraries, so the same face can come back in the client's next project (I29).
export async function saveActorToLibrary(projectId: string, name: string): Promise<Result> {
  const { t } = await getI18n();
  try {
    const { supabase, project } = await loadProject(projectId);
    const doc = await stageFive(supabase, projectId);
    const c = doc.characters.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!c) return { error: "Character not found." };
    const key = c.name.trim().toLowerCase().slice(0, 200);
    const [{ data: gen }, { data: look }] = await Promise.all([
      supabase.from("gen_assets").select("kind, key, path, version").eq("project_id", projectId).in("kind", ["sheet", "outfit"]).eq("status", "ready").order("version", { ascending: false }),
      supabase.from("look_images").select("key, path, version").eq("project_id", projectId).eq("kind", "character").eq("key", key).eq("status", "ready").order("version", { ascending: false }).limit(1),
    ]);
    const firstOf = new Map<string, string>();
    for (const r of gen ?? []) if (r.path && !firstOf.has(`${r.kind}:${r.key}`)) firstOf.set(`${r.kind}:${r.key}`, r.path);
    const sources = [firstOf.get(`sheet:${key}`), look?.[0]?.path, ...[...firstOf.entries()].filter(([k]) => k.startsWith(`outfit:${key}|`)).map(([, p]) => p)].filter((p): p is string => Boolean(p && p.startsWith(`${project.workspace_id}/projects/${projectId}/`) && !p.includes("..")));
    if (!sources.length) return { error: t.generate.noPicture };
    const admin = createAdminClient();
    const paths: string[] = [];
    for (const [i, from] of sources.slice(0, 12).entries()) {
      const to = `${project.workspace_id}/library/actor-${Date.now()}-${i}.${from.split(".").pop() ?? "jpg"}`;
      const { error } = await admin.storage.from("media").copy(from, to);
      if (!error) paths.push(to);
    }
    if (!paths.length) return { error: "Could not copy the pictures." };
    const voiceId = doc.lock.voices?.[key];
    const voice = voiceId ? `ElevenLabs ${VOICES.find((v) => v.id === voiceId)?.name ?? ""} (${voiceId})` : null;
    const outfits = doc.wardrobe.filter((w) => w.character.trim().toLowerCase() === key).map((w) => `${w.scene}: ${w.outfit}`).join("\n");
    const row = { name: c.name.slice(0, 120), description: (c.role ?? "").slice(0, 4000), age: (c.age ?? "").slice(0, 60), look: (c.look ?? "").slice(0, 4000), wardrobe: outfits.slice(0, 4000), voice, image_paths: paths, updated_at: new Date().toISOString() };
    const { data: existing } = await supabase.from("characters").select("id").eq("workspace_id", project.workspace_id).eq("name", row.name).limit(1);
    const res = existing?.length
      ? await supabase.from("characters").update(row).eq("id", existing[0].id)
      : await supabase.from("characters").insert({ ...row, workspace_id: project.workspace_id });
    if (res.error) return { error: res.error.message };
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  revalidatePath("/libraries");
  return {};
}
