import { revalidatePath } from "next/cache";
import { runStageOne, type DocsEvent } from "@/lib/stage-one-run";

// The stage 1 documents, written or revised, streamed step by step (one JSON per line).
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { instruction?: string } | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: DocsEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // Closed by Stop.
        }
      };
      try {
        await runStageOne(id, body?.instruction, emit, req.signal);
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
