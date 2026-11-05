"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { missingRequired, writeStageOne, type BriefFields } from "@/lib/ai/brain";
import { TEXT_MODELS, textModel } from "@/lib/ai/catalog";
import { transcribe } from "@/lib/ai/transcribe";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, notify, saveVersion, STAGE_OUTPUTS, type Path } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";
import { FILE_TYPES, loadProject, noticeFallback, ownPath, runBriefMessage, type BriefPayload } from "@/lib/brief-turn";

export type Result = { error?: string };

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

// ---------- Create ----------

export async function createProject() {
  const me = await getCurrentMember();
  if (!me || !["admin", "producer"].includes(me.role)) redirect("/projects");
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ workspace_id: me.workspace.id, name: t.project.untitled, created_by: me.userId })
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
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "transcribe", provider: "kie.ai", model: "gemini-3-8-flash", ok: false, error: errText(e) });
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
    const { supabase } = await loadProject(projectId);
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

export async function writeBriefDocuments(projectId: string, instruction?: string): Promise<Result> {
  const { t, locale } = await getI18n();
  try {
    const { me, supabase, project, model } = await loadProject(projectId);
    const brief = project.brief as BriefFields;
    if (missingRequired(brief).length) return { error: t.project.answerFirst };

    const { data: outs } = await supabase
      .from("outputs")
      .select("id, workspace_id, number, current_version")
      .eq("project_id", projectId)
      .in("number", [3, 4, 5, 6]);
    await supabase.from("outputs").update({ status: "generating" }).eq("project_id", projectId).in("number", [3, 4, 5, 6]);

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
      result = await writeStageOne(brief, project.path ?? project.path_suggested, today, language, model, revise);
    } catch (e) {
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "stage1-docs", provider: textModel(model).provider, model, ok: false, error: errText(e) });
      // Keep earlier versions; only steps that never had one are marked failed.
      for (const o of outs ?? []) {
        await supabase.from("outputs").update({ status: o.current_version > 0 ? "ready" : "failed" }).eq("id", o.id);
      }
      revalidatePath(`/p/${projectId}`);
      return { error: e instanceof Error && e.message.includes("Gemini") ? e.message : t.project.aiFailed };
    }
    const { docs, usage } = result;
    await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "stage1-docs", provider: textModel(result.model).provider, model: result.model, ok: true, usage, fallbackFrom: result.fallbackFrom });
    if (result.fallbackFrom) await noticeFallback(me.workspace.id, projectId, result.fallbackFrom, result.model, result.firstError);

    const content: Record<number, unknown> = {
      3: docs.summary,
      4: docs.strategy,
      5: docs.pathway,
      6: { cps: docs.cps, kickoff_notes: docs.kickoff_notes },
    };
    for (const o of outs ?? []) await saveVersion(supabase, o, content[o.number], "ai", me.userId, result.model);
    if (!project.path) {
      await supabase.from("projects").update({ path: docs.pathway.path }).eq("id", projectId);
    }
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
    const needed = stage === 1 ? [3, 4, 5, 6] : (outs ?? []).map((o) => o.number);
    const ready = (outs ?? []).filter((o) => ["ready", "edited", "approved"].includes(o.status)).map((o) => o.number);
    if (!needed.every((n) => ready.includes(n))) return { error: t.project.notReady };
    if (stage === 1 && !project.path) return { error: t.project.choosePathFirst };

    const now = new Date().toISOString();
    await supabase.from("outputs").update({ status: "approved", updated_at: now }).eq("project_id", projectId).eq("stage", stage);
    await supabase.from("stages").update({ status: "approved", approved_by: me.userId, approved_at: now }).eq("project_id", projectId).eq("number", stage);

    // The next stage that applies to the path.
    const order = project.path === "ai" ? [1, 2, 3, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7];
    const next = order[order.indexOf(stage) + 1];
    if (next) {
      await supabase.from("stages").update({ status: "active" }).eq("project_id", projectId).eq("number", next);
      const nums = STAGE_OUTPUTS[next] ?? [];
      if (nums.length) {
        await supabase
          .from("outputs")
          .insert(nums.map((n) => ({ workspace_id: me.workspace.id, project_id: projectId, stage: next, number: n })));
      }
      await supabase.from("projects").update({ current_stage: next, updated_at: now }).eq("id", projectId);
    }
  } catch (e) {
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

// ---------- Edits by people ----------

// Saves a person's edit as a new version. The earlier version is kept and can be restored.
export async function saveOutputEdit(projectId: string, number: number, content: unknown): Promise<Result> {
  if (![3, 4, 5, 6].includes(number)) return { error: "This step can't be edited here." };
  try {
    const { me, supabase, project } = await loadProject(projectId);
    if (project.current_stage !== 1) return { error: "This stage is approved. Changes come with a new version in a later milestone." };
    const { data: o } = await supabase
      .from("outputs")
      .select("id, workspace_id, current_version")
      .eq("project_id", projectId)
      .eq("number", number)
      .maybeSingle();
    if (!o) return { error: "Step not found." };
    await saveVersion(supabase, o, content, "edit", me.userId, null);
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
