import { transcribe } from "@/lib/ai/transcribe";
import { loadProject, ownPath } from "@/lib/brief-turn";
import { logAiJob, notify } from "@/lib/projects";
import { createAdminClient } from "@/lib/supabase/admin";

// Turns a recorded voice note into text for the reply box.
// Fast path: the browser sends the recording itself (audio/wav) while it saves a copy to
// storage at the same time. Long notes (over 4 MB) are read from storage by their path.
// Answer, one JSON per line: {t:"text", d}, then {t:"done"} or {t:"error", message}.
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const type = req.headers.get("content-type") ?? "";
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
        let audio: Buffer;
        if (type.startsWith("audio/")) {
          audio = Buffer.from(await req.arrayBuffer());
          if (audio.length > 4.4 * 1024 * 1024) throw new Error("That recording is too long. Keep voice notes under 2 minutes.");
        } else {
          const body = (await req.json().catch(() => null)) as { path?: string } | null;
          const path = body?.path ?? "";
          if (!ownPath(path, me.workspace.id, id)) throw new Error("Recording not found.");
          const { data: file } = await createAdminClient().storage.from("media").download(path);
          if (!file) throw new Error("Recording not found.");
          audio = Buffer.from(await file.arrayBuffer());
        }
        const r = await transcribe(audio, "audio/wav", req.signal);
        send({ t: "text", d: r.text });
        await logAiJob({ workspaceId: ws, projectId: id, userId: uid, task: "transcribe", provider: r.provider, model: r.model, ok: true, usage: r.usage });
        send({ t: "done" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Something went wrong";
        if (ws && !req.signal.aborted) {
          await logAiJob({ workspaceId: ws, projectId: id, userId: uid, task: "transcribe", provider: "google", model: "gemini-3.5-transcribe", ok: false, error: message });
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
