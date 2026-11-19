import { revalidatePath } from "next/cache";
import { runGenerate, type GenEvent, type GenRequest } from "@/lib/generate";

// Stage 5 jobs (sheets, outfits, keyframes, clips, voice, voice tries, music), streamed one step per line.
// Stop ends the waiting; jobs already started on Kie.ai are collected when the page loads.
export const maxDuration = 300;

const KINDS = new Set(["sheet", "outfit", "keyframe", "clip", "voice", "voicetry", "portrait", "avatartry", "product", "music"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: GenEvent | { t: "done" } | { t: "error"; message: string }) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          // Closed by Stop.
        }
      };
      try {
        const kind = String(body?.kind ?? "");
        if (!KINDS.has(kind)) throw new Error("Nothing to do.");
        const strings = (x: unknown) => (Array.isArray(x) ? [...new Set(x.map((v) => String(v).slice(0, 200)).filter(Boolean))].slice(0, 60) : []);
        const numbers = (x: unknown) => (Array.isArray(x) ? [...new Set(x.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 200))].slice(0, 60) : []);
        const prompts = body?.prompts && typeof body.prompts === "object" ? Object.fromEntries(Object.entries(body.prompts as Record<string, unknown>).slice(0, 60).map(([k, v]) => [k.slice(0, 10), String(v).slice(0, 2400)])) : undefined;
        const request: GenRequest =
          kind === "sheet" ? { kind, names: strings(body?.names) }
          : kind === "outfit" ? { kind, keys: strings(body?.keys) }
          : kind === "keyframe" ? { kind, shots: numbers(body?.shots), model: body?.model ? String(body.model) : undefined }
          : kind === "clip" ? { kind, shots: numbers(body?.shots), model: body?.model ? String(body.model) : undefined, prompts, auto: body?.auto !== false }
          : kind === "voice" ? { kind, keys: strings(body?.keys) }
          : kind === "voicetry" ? { kind, who: body?.who ? String(body.who).slice(0, 200) : null }
          : kind === "product" ? { kind, name: String(body?.name ?? "").slice(0, 200) }
          : kind === "portrait" || kind === "avatartry" ? { kind, who: String(body?.who ?? "").slice(0, 200) }
          : { kind: "music" };
        await runGenerate(id, request, emit, req.signal);
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
