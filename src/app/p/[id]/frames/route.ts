import { revalidatePath } from "next/cache";
import type { Aspect, Style } from "@/lib/ai/images";
import { runFrames, type FrameEvent } from "@/lib/frames";

// Draws storyboard frames, streamed frame by frame (one JSON per line). Stop ends the work.
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { frames?: unknown; style?: string; model?: string; aspect?: string } | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: FrameEvent | { t: "done" } | { t: "error"; message: string }) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // Closed by Stop.
        }
      };
      try {
        const frames = Array.isArray(body?.frames) ? [...new Set(body.frames.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 200))].slice(0, 60) : [];
        if (!frames.length) throw new Error("Nothing to do.");
        await runFrames(id, { frames, style: (body?.style ?? "sketch") as Style, model: String(body?.model ?? ""), aspect: (body?.aspect ?? "16:9") as Aspect }, emit, req.signal);
        revalidatePath(`/p/${id}`);
        emit({ t: "done" });
      } catch (e) {
        revalidatePath(`/p/${id}`);
        emit({ t: "error", message: e instanceof Error ? e.message : "Something went wrong" });
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
