import "server-only";
import { briefTurn, missingRequired, type Attachment, type BriefFields, type Step } from "@/lib/ai/brain";
import { backupFor, StoppedError } from "@/lib/ai/brain-core";
import { isFailing } from "@/lib/ai/health";
import { activeRules } from "@/lib/dev";
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
  | { t: "skip"; from: string; to: string }
  | { t: "fields"; keys: string[] }
  | { t: "path"; path: string }
  | { t: "memory"; items: string[] }
  | { t: "save" }
  | { t: "done" }
  | { t: "error"; message: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Steps saved with the reply, so the person can open "what Menab did" afterwards.
export type SavedSteps = { events: BriefEvent[]; seconds: number; model: string };

export async function runBriefMessage(projectId: string, payload: BriefPayload, send: (e: BriefEvent) => void, signal?: AbortSignal) {
  const started = Date.now();
  const events: BriefEvent[] = [];
  const emit = (e: BriefEvent) => {
    events.push({ ...e, at: Date.now() - started } as unknown as BriefEvent);
    send(e);
  };
  const clean = payload.text.trim().slice(0, 8000);
  const list = (payload.files ?? []).slice(0, 5);
  if (!clean && !list.length) return;
  const loaded = await loadProject(projectId);
  const { me, supabase, project } = loaded;
  // The brief chat is closed once stage 1 is approved.
  if (project.current_stage !== 1) throw new Error("The brief is approved. The chat is read only now.");
  let model = loaded.model;
  const { t } = await getI18n();
  const voice = payload.voice && ownPath(payload.voice.path, me.workspace.id, projectId) ? payload.voice : undefined;
  emit({ t: "read", files: list.length, voice: Boolean(voice) });
  // A model that keeps failing right now is skipped, so nobody waits for it to fail again.
  if (await isFailing(model)) {
    const backup = textModel(backupFor(textModel(model))).id;
    emit({ t: "skip", from: textModel(model).name, to: textModel(backup).name });
    model = backup;
  }

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

  // What Menab remembers about this company (Settings, Memory), unless it is turned off.
  const { data: ws } = await supabase.from("workspaces").select("memory_on").eq("id", project.workspace_id).maybeSingle();
  const memoryOn = ws?.memory_on !== false;
  const memory = memoryOn
    ? ((await supabase.from("memories").select("content").eq("workspace_id", project.workspace_id).order("created_at", { ascending: false }).limit(40)).data ?? []).map((r) => r.content as string)
    : [];

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
      { signal, memory, rules: await activeRules() },
    );
  } catch (e) {
    if (signal?.aborted || e instanceof StoppedError) throw new StoppedError();
    await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "brief", provider: textModel(model).provider, model, ok: false, error: errText(e) });
    await notify({ workspaceId: me.workspace.id, projectId, kind: "ai_failed", title: `${textModel(model).name} and its backup did not answer a brief message`, body: errText(e) });
    throw new Error(t.project.aiFailed);
  }
  // Stopped while the answer came in: keep nothing.
  if (signal?.aborted) throw new StoppedError();
  const { turn, usage } = result;
  const used = result.model;
  await logAiJob({ workspaceId: me.workspace.id, projectId, userId: me.userId, task: "brief", provider: textModel(used).provider, model: used, ok: true, usage, fallbackFrom: result.fallbackFrom });
  if (result.fallbackFrom) await noticeFallback(me.workspace.id, projectId, result.fallbackFrom, used, result.firstError);

  const changed = (Object.keys(turn.brief) as (keyof BriefFields)[]).filter((k) => k !== "project_name" && !same(before[k], turn.brief[k]));
  if (changed.length) emit({ t: "fields", keys: changed });
  if (turn.path.suggested && turn.path.suggested !== project.path_suggested) emit({ t: "path", path: turn.path.suggested });
  // New lasting facts, skipping ones Menab already knows.
  if (memoryOn && turn.remember.length) {
    const known = new Set(memory.map((m) => m.toLowerCase()));
    const fresh = turn.remember.filter((m) => !known.has(m.toLowerCase())).map((m) => m.slice(0, 300));
    if (fresh.length) {
      await supabase.from("memories").insert(fresh.map((content) => ({ workspace_id: me.workspace.id, content, source: "ai", project_id: projectId })));
      emit({ t: "memory", items: fresh });
    }
  }
  emit({ t: "save" });
  const steps: SavedSteps = { events: [...events], seconds: Math.round((Date.now() - started) / 100) / 10, model: textModel(used).name };

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
    steps,
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
