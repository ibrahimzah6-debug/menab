import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Outputs per stage in v1 (numbers from the Workflow Map). Later items are added in later milestones.
export const STAGE_OUTPUTS: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6],
  2: [7, 8, 9, 10, 11, 12],
  3: [13, 14, 15, 16, 17, 18],
  4: [20, 22, 25, 26, 27, 28, 31, 32],
  5: [34, 35, 36, 37, 38],
  7: [52, 53, 54, 55],
};

export type Path = "ai" | "production" | "hybrid";

// Stages that do not apply to the path are hidden: the AI path has no pre-production, and Edit is v2.
export function stageNumbersFor(path: Path | null) {
  return path === "ai" ? [1, 2, 3, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7];
}

export async function saveVersion(
  supabase: SupabaseClient,
  o: { id: string; workspace_id: string; current_version: number },
  content: unknown,
  source: "ai" | "edit" | "restore",
  userId: string,
  model: string | null,
  status: "ready" | "edited" | "approved" = source === "edit" ? "edited" : "ready",
) {
  const next = o.current_version + 1;
  const { error } = await supabase.from("versions").insert({
    workspace_id: o.workspace_id,
    output_id: o.id,
    version: next,
    content,
    source,
    model,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  await supabase
    .from("outputs")
    .update({ current_version: next, status, updated_at: new Date().toISOString() })
    .eq("id", o.id);
  o.current_version = next;
}

// Every AI call is logged with its real cost. The table is written by the server only.
export async function logAiJob(job: {
  workspaceId: string;
  projectId: string | null;
  userId: string;
  task: string;
  provider: string;
  model: string;
  ok: boolean;
  usage?: { inputTokens: number; outputTokens: number; costUsd: number; seconds: number };
  error?: string;
  fallbackFrom?: string;
}) {
  try {
    await createAdminClient().from("ai_jobs").insert({
      workspace_id: job.workspaceId,
      project_id: job.projectId,
      task: job.task,
      provider: job.provider,
      model: job.model,
      status: job.ok ? "success" : "failed",
      input_tokens: job.usage?.inputTokens ?? null,
      output_tokens: job.usage?.outputTokens ?? null,
      // A failed call costs the user nothing.
      cost_usd: job.ok ? job.usage?.costUsd ?? 0 : 0,
      seconds: job.usage?.seconds ?? null,
      error: job.error?.slice(0, 500) ?? null,
      fallback_from: job.fallbackFrom ?? null,
      created_by: job.userId,
    });
  } catch {
    // Logging must never break the user's action.
  }
}

// A notice for the workspace (and the owner dashboard), for example when the backup AI answered.
export async function notify(n: {
  workspaceId: string | null;
  kind: "ai_fallback" | "ai_failed" | "generation_done" | "approval_waiting" | "info";
  title: string;
  body?: string;
  projectId?: string | null;
}) {
  try {
    await createAdminClient().from("notifications").insert({
      workspace_id: n.workspaceId,
      kind: n.kind,
      title: n.title.slice(0, 300),
      body: n.body?.slice(0, 2000) ?? null,
      project_id: n.projectId ?? null,
    });
  } catch {
    // A notice must never break the user's action.
  }
}

// Marks outputs as being written, unless they already are (a second press, or a second tab).
// Returns false when another run started in the last 6 minutes, so nobody pays twice. A run
// that died more than 6 minutes ago no longer blocks.
export async function claimForWriting(supabase: SupabaseClient, projectId: string, numbers: number[]) {
  const recent = new Date(Date.now() - 6 * 60_000).toISOString();
  const { data: busy } = await supabase
    .from("outputs")
    .select("number")
    .eq("project_id", projectId)
    .in("number", numbers)
    .eq("status", "generating")
    .gte("updated_at", recent);
  if (busy?.length) return false;
  await supabase.from("outputs").update({ status: "generating", updated_at: new Date().toISOString() }).eq("project_id", projectId).in("number", numbers);
  return true;
}
