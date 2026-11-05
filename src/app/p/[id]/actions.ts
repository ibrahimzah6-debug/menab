"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { briefTurn, missingRequired, writeStageOne, type BriefFields } from "@/lib/ai/brain";
import { BRAIN, DEFAULT_TEXT_MODEL, TEXT_MODELS, textModel } from "@/lib/ai/catalog";
import { transcribe } from "@/lib/ai/transcribe";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, saveVersion, STAGE_OUTPUTS, type Path } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember, getMemberships } from "@/lib/workspace";

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

async function loadProject(projectId: string) {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, workspace_id, name, client, brief, path, path_suggested, current_stage, models")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");
  // The person's role in the project's own workspace.
  const me = (await getMemberships()).find((m) => m.workspace.id === project.workspace_id);
  if (!me) throw new Error("Log in again.");
  if (!["admin", "producer", "coordinator"].includes(me.role)) throw new Error("Viewers can read and comment only.");
  const { data: setting } = await supabase
    .from("model_settings")
    .select("model_id")
    .eq("workspace_id", project.workspace_id)
    .eq("task", "text")
    .maybeSingle();
  // The model picked on this project's steps, else the workspace default, else Menab's default.
  const models = (project.models ?? {}) as { text?: string };
  const model = textModel(models.text ?? setting?.model_id ?? DEFAULT_TEXT_MODEL).id;
  return { me, supabase, project, model };
}

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

// The user's new message is only saved once Menab AI answers, so a failed call leaves no trace
// and the person can simply send it again.
async function runBriefTurn(
  projectId: string,
  newMessage: { content: string; kind: "text" | "voice"; audio_path?: string; audio_seconds?: number | null },
) {
  const { me, supabase, project, model } = await loadProject(projectId);
  const { t } = await getI18n();
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(60);

  let result;
  try {
    result = await briefTurn(
      [
        ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: newMessage.content },
      ],
      project.brief as Partial<BriefFields>,
      model,
    );
  } catch (e) {
    await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "brief", provider: BRAIN.provider, model, ok: false, error: errText(e) });
    throw new Error(t.project.aiFailed);
  }
  const { turn, usage } = result;
  await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "brief", provider: BRAIN.provider, model, ok: true, usage });

  await supabase.from("messages").insert({
    workspace_id: me.workspace.id,
    project_id: projectId,
    role: "user",
    kind: newMessage.kind,
    content: newMessage.content.slice(0, 20000),
    audio_path: newMessage.audio_path ?? null,
    audio_seconds: newMessage.audio_seconds ?? null,
    created_by: me.userId,
  });
  await supabase.from("messages").insert({
    workspace_id: me.workspace.id,
    project_id: projectId,
    role: "assistant",
    content: turn.reply.slice(0, 20000),
    created_by: me.userId,
  });

  const keepName = project.name !== t.project.untitled && project.name !== "New project" && project.name !== "مشروع جديد";
  await supabase
    .from("projects")
    .update({
      brief: turn.brief,
      name: keepName ? project.name : (turn.brief.project_name || project.name).slice(0, 160),
      client: turn.brief.client?.slice(0, 160) ?? project.client,
      path_suggested: turn.path.suggested,
      path_reason: turn.path.reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  // Outputs 1 (brief intake) and 2 (questions) keep a version each time they change.
  const { data: outs } = await supabase
    .from("outputs")
    .select("id, workspace_id, number, current_version")
    .eq("project_id", projectId)
    .in("number", [1, 2]);
  for (const o of outs ?? []) {
    const content = o.number === 1 ? { brief: turn.brief } : { questions: turn.questions, missing: missingRequired(turn.brief) };
    await saveVersion(supabase, o, content, "ai", me.userId, model);
  }
}

export async function sendBriefMessage(projectId: string, text: string): Promise<Result> {
  const clean = text.trim().slice(0, 8000);
  if (!clean) return {};
  try {
    await runBriefTurn(projectId, { content: clean, kind: "text" });
  } catch (e) {
    revalidatePath(`/p/${projectId}`);
    return { error: errText(e) };
  }
  revalidatePath(`/p/${projectId}`);
  return {};
}

export async function sendVoiceNote(projectId: string, form: FormData): Promise<Result> {
  const file = form.get("audio");
  const seconds = Number(form.get("seconds") ?? 0);
  if (!(file instanceof Blob) || file.size === 0) return { error: "No recording found." };
  if (file.size > 15 * 1024 * 1024) return { error: "That recording is too long. Keep voice notes under 5 minutes." };
  const { t } = await getI18n();
  try {
    const { me, supabase } = await loadProject(projectId);
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = (file.type || "audio/webm").split(";")[0];
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    const path = `${me.workspace.id}/projects/${projectId}/voice/${Date.now()}.${ext}`;
    // Our own copy of every voice note.
    await createAdminClient().storage.from("media").upload(path, buf, { contentType: mime });

    let text: string;
    try {
      const r = await transcribe(buf, mime);
      text = r.text;
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "transcribe", provider: r.provider, model: r.model, ok: true, usage: r.usage });
    } catch (e) {
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "transcribe", provider: process.env.GEMINI_API_KEY ? "google" : "kie.ai", model: "gemini", ok: false, error: errText(e) });
      return { error: t.project.voiceFailed };
    }

    const voice = {
      content: text,
      kind: "voice" as const,
      audio_path: path,
      audio_seconds: Number.isFinite(seconds) ? Math.round(seconds) : null,
    };
    try {
      await runBriefTurn(projectId, voice);
    } catch (e) {
      // Keep the transcript so the person does not have to record again; the next message continues from it.
      await supabase.from("messages").insert({
        workspace_id: me.workspace.id,
        project_id: projectId,
        role: "user",
        kind: "voice",
        content: text.slice(0, 20000),
        audio_path: path,
        audio_seconds: voice.audio_seconds,
        created_by: me.userId,
      });
      throw e;
    }
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

export async function writeBriefDocuments(projectId: string): Promise<Result> {
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
      result = await writeStageOne(brief, project.path ?? project.path_suggested, today, language, model);
    } catch (e) {
      await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "stage1-docs", provider: BRAIN.provider, model, ok: false, error: errText(e) });
      await supabase.from("outputs").update({ status: "failed" }).eq("project_id", projectId).in("number", [3, 4, 5, 6]);
      revalidatePath(`/p/${projectId}`);
      return { error: t.project.aiFailed };
    }
    const { docs, usage } = result;
    await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "stage1-docs", provider: BRAIN.provider, model, ok: true, usage });

    const content: Record<number, unknown> = {
      3: docs.summary,
      4: docs.strategy,
      5: docs.pathway,
      6: { cps: docs.cps, kickoff_notes: docs.kickoff_notes },
    };
    for (const o of outs ?? []) await saveVersion(supabase, o, content[o.number], "ai", me.userId, model);
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
