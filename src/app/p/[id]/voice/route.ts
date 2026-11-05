import { transcribeStreaming } from "@/lib/ai/transcribe";
import { loadProject, ownPath } from "@/lib/brief-turn";
import { logAiJob, notify } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";

// Turns a recorded voice note into text, streamed word by word into the reply box.
// One JSON per line: {t:"text", d}, then {t:"done"} or {t:"error", message}.
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { path?: string } | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // Closed by Stop.
        }
      };
      let ws = "";
      let uid = "";
      try {
        const { me } = await loadProject(id);
        ws = me.workspace.id;
        uid = me.userId;
        const path = body?.path ?? "";
        if (!ownPath(path, me.workspace.id, id)) throw new Error("Recording not found.");
        const { data: file } = await createAdminClient().storage.from("media").download(path);
        if (!file) throw new Error("Recording not found.");
        const r = await transcribeStreaming(Buffer.from(await file.arrayBuffer()), "audio/wav", (d) => send({ t: "text", d }), req.signal);
        await logAiJob({ workspaceId: ws, projectId: id, userId: uid, task: "transcribe", provider: r.provider, model: r.model, ok: true, usage: r.usage });
        send({ t: "done" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Something went wrong";
        if (ws && !req.signal.aborted) {
          await logAiJob({ workspaceId: ws, projectId: id, userId: uid, task: "transcribe", provider: "kie.ai", model: "gemini-3-8-flash", ok: false, error: message });
          await notify({ workspaceId: ws, projectId: id, kind: "ai_failed", title: "A voice note could not be turned into text", body: message });
        }
        send({ t: "error", message });
      }
      try {
        controller.close();
      } catch {
        // Already closed.
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
