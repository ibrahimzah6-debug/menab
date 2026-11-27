import { NextResponse } from "next/server";
import { loadProject } from "@/lib/brief-turn";
import { settlePending } from "@/lib/generate";

// A small answer to "has anything changed?" while AI work runs: one line built from when the
// project's documents, pictures and media last changed. The page reloads only when it changes,
// instead of reloading (and downloading every picture) every few seconds.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { supabase, project } = await loadProject(id);
    // Stage 5 work that finishes on Kie.ai after its request ended is collected here.
    if (project.current_stage === 5) await settlePending(id);
    const last = async (table: string) => {
      const { data, count } = await supabase.from(table).select("updated_at", { count: "exact" }).eq("project_id", id).order("updated_at", { ascending: false }).limit(1);
      return `${count ?? 0}@${data?.[0]?.updated_at ?? ""}`;
    };
    const parts = await Promise.all(["outputs", "frame_images", "look_images", "gen_assets"].map(last));
    return NextResponse.json({ v: `${project.current_stage}|${parts.join("|")}` }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ v: null }, { status: 404 });
  }
}
