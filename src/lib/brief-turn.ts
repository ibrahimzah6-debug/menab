import "server-only";
import { briefTurn, missingRequired, type Attachment, type BriefFields, type Step } from "@/lib/ai/brain";
import { DEFAULT_TEXT_MODEL, textModel } from "@/lib/ai/catalog";
import { getI18n } from "@/lib/i18n/server";
import { logAiJob, notify, saveVersion } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/workspace";

// The brief conversation, shared by the chat's live endpoint and the server actions.

export const FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export async function loadProject(projectId: string) {
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

export function ownPath(path: string, workspaceId: string, projectId: string) {
  return path.startsWith(`${workspaceId}/projects/${projectId}/`) && !path.includes("..");
}

export async function noticeFallback(workspaceId: string, projectId: string, from: string, to: string, error?: string) {
  await notify({
    workspaceId,
    projectId,
    kind: "ai_fallback",
    title: `${textModel(from).name} did not answer, so ${textModel(to).name} took over`,
    body: error,
  });
}

export type BriefPayload = {
  text: string;
  files: { path: string; name: string; mime: string }[];
  voice?: { path: string; seconds: number };
};

// What the chat shows while Menab works: each real step, as it happens.
export type BriefEvent =
  | { t: "read"; files: number; voice: boolean }
  | { t: "call"; model: string }
  | { t: "retry"; model: string }
  | { t: "switch"; from: string; to: string }
  | { t: "fields"; keys: string[] }
  | { t: "path"; path: string }
  | { t: "save" }
  | { t: "done" }
  | { t: "error"; message: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function runBriefMessage(projectId: string, payload: BriefPayload, emit: (e: BriefEvent) => void) {
  const clean = payload.text.trim().slice(0, 8000);
  const list = (payload.files ?? []).slice(0, 5);
  if (!clean && !list.length) return;
  const { me, supabase, project, model } = await loadProject(projectId);
  const { t } = await getI18n();
  const voice = payload.voice && ownPath(payload.voice.path, me.workspace.id, projectId) ? payload.voice : undefined;
  emit({ t: "read", files: list.length, voice: Boolean(voice) });

  const admin = createAdminClient();
  const files: Attachment[] = [];
  for (const f of list) {
    if (!ownPath(f.path, me.workspace.id, projectId) || !FILE_TYPES.includes(f.mime)) throw new Error("File not found.");
    const { data } = await admin.storage.from("media").download(f.path);
    if (!data) throw new Error("File not found.");
    files.push({ mime: f.mime, base64: Buffer.from(await data.arrayBuffer()).toString("base64"), name: f.name });
  }
  const names = list.map((a) => a.name).join(", ");
  const content = clean ? (names ? `${clean}\n\nAttached: ${names}` : clean) : `(${names})`;

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(60);

  const onStep = (s: Step) => {
    if (s.kind === "calling") emit({ t: "call", model: s.model });
    else if (s.kind === "retrying") emit({ t: "retry", model: s.model });
    else emit({ t: "switch", from: s.from, to: s.to });
  };

  const before = (project.brief ?? {}) as Partial<BriefFields>;
  let result;
  try {
    result = await briefTurn(
      [
        ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content, files },
      ],
      before,
      model,
      onStep,
    );
  } catch (e) {
    await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "brief", provider: textModel(model).provider, model, ok: false, error: errText(e) });
    await notify({ workspaceId: me.workspace.id, projectId, kind: "ai_failed", title: `${textModel(model).name} and its backup did not answer a brief message`, body: errText(e) });
    throw new Error(t.project.aiFailed);
  }
  const { turn, usage } = result;
  const used = result.model;
  await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "brief", provider: textModel(used).provider, model: used, ok: true, usage, fallbackFrom: result.fallbackFrom });
  if (result.fallbackFrom) await noticeFallback(me.workspace.id, projectId, result.fallbackFrom, used, result.firstError);

  const changed = (Object.keys(turn.brief) as (keyof BriefFields)[]).filter((k) => k !== "project_name" && !same(before[k], turn.brief[k]));
  if (changed.length) emit({ t: "fields", keys: changed });
  if (turn.path.suggested && turn.path.suggested !== project.path_suggested) emit({ t: "path", path: turn.path.suggested });
  emit({ t: "save" });

  await supabase.from("messages").insert({
    workspace_id: me.workspace.id,
    project_id: projectId,
    role: "user",
    kind: voice ? "voice" : "text",
    content: content.slice(0, 20000),
    audio_path: voice?.path ?? null,
    audio_seconds: voice ? Math.round(voice.seconds) : null,
    attachments: list.map((f) => ({ path: f.path, name: f.name.slice(0, 200), mime: f.mime })),
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
    const c = o.number === 1 ? { brief: turn.brief } : { questions: turn.questions, missing: missingRequired(turn.brief) };
    await saveVersion(supabase, o, c, "ai", me.userId, used);
  }
}
