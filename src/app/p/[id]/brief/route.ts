import { revalidatePath } from "next/cache";
import { runBriefMessage, type BriefEvent, type BriefPayload } from "@/lib/brief-turn";

// The brief chat sends each message here. The answer is a stream of steps (one JSON per line)
// so the person sees what Menab is doing, then "done" or "error". Never more than 5 minutes.
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as BriefPayload | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: BriefEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (!payload || typeof payload.text !== "string") throw new Error("Nothing to send.");
        await runBriefMessage(id, { text: payload.text, files: Array.isArray(payload.files) ? payload.files : [], voice: payload.voice }, emit);
        revalidatePath(`/p/${id}`);
        emit({ t: "done" });
      } catch (e) {
        emit({ t: "error", message: e instanceof Error ? e.message : "Something went wrong" });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
