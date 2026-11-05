import { transcribe } from "@/lib/ai/transcribe";
import { logAiJob, notify } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";

// Voice to text for any box outside the brief chat (change instructions, meeting notes,
// memory, ideas). The browser sends the short recording itself; nothing is stored.
export const maxDuration = 120;

export async function POST(req: Request) {
  const me = await getCurrentMember();
  if (!me) return Response.json({ error: "Log in again." }, { status: 401 });
  const audio = Buffer.from(await req.arrayBuffer());
  if (!audio.length) return Response.json({ error: "Nothing was recorded." }, { status: 400 });
  if (audio.length > 4.4 * 1024 * 1024) return Response.json({ error: "That recording is too long. Keep it under 2 minutes." }, { status: 413 });
  // The project, when the box is inside one, so the cost is counted there.
  let projectId: string | null = req.headers.get("x-project");
  let workspaceId = me.workspace.id;
  if (projectId) {
    const { data } = await (await createClient()).from("projects").select("workspace_id").eq("id", projectId).maybeSingle();
    if (data) workspaceId = data.workspace_id;
    else projectId = null;
  }
  try {
    const r = await transcribe(audio, "audio/wav", req.signal);
    await logAiJob({ workspaceId, projectId, userId: me.userId, task: "transcribe", provider: r.provider, model: r.model, ok: true, usage: r.usage });
    return Response.json({ text: r.text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Something went wrong";
    if (!req.signal.aborted) {
      await logAiJob({ workspaceId, projectId, userId: me.userId, task: "transcribe", provider: "google", model: "gemini-3.5-transcribe", ok: false, error: message });
      await notify({ workspaceId, projectId: projectId ?? undefined, kind: "ai_failed", title: "A voice note could not be turned into text", body: message });
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
