import { revalidatePath } from "next/cache";
import type { CreativeEvent } from "@/lib/creative-run";
import { runLook } from "@/lib/look-run";

// Stage 3's documents, streamed step by step (one JSON per line). Stop ends the work.
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { kind?: string; n?: number; instruction?: string } | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: CreativeEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // Closed by Stop.
        }
      };
      try {
        const kind = body?.kind;
        const action =
          kind === "write" ? ({ kind } as const)
          : kind === "redo" && body?.n ? ({ kind, n: Number(body.n) } as const)
          : kind === "revise" && body?.n && body.instruction?.trim() ? ({ kind, n: Number(body.n), instruction: body.instruction.trim().slice(0, 2000) } as const)
          : null;
        if (!action) throw new Error("Nothing to do.");
        await runLook(id, action, emit, req.signal);
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
