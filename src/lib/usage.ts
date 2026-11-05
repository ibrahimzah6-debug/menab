import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// People who run Menab itself see the owner dashboard.
export const isPlatformAdmin = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return false;
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", uid).maybeSingle();
  return Boolean(data);
});

export type Job = {
  workspace_id: string;
  project_id: string | null;
  task: string;
  provider: string;
  model: string;
  status: string;
  cost_usd: number;
  seconds: number | null;
  fallback_from: string | null;
  error: string | null;
  created_at: string;
};

export type ModelRow = { model: string; provider: string; calls: number; ok: number; backups: number; cost: number; avgSeconds: number | null };

export function byModel(jobs: Job[]): ModelRow[] {
  const map = new Map<string, Job[]>();
  for (const j of jobs) map.set(j.model, [...(map.get(j.model) ?? []), j]);
  return [...map.entries()]
    .map(([model, list]) => {
      const secs = list.map((j) => Number(j.seconds)).filter((n) => Number.isFinite(n) && n > 0);
      return {
        model,
        provider: list[0].provider,
        calls: list.length,
        ok: list.filter((j) => j.status === "success").length,
        backups: list.filter((j) => j.fallback_from).length,
        cost: list.reduce((s, j) => s + Number(j.cost_usd ?? 0), 0),
        avgSeconds: secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null,
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

// Everything across Menab, for the owner. Uses the server key after the owner check.
export async function ownerOverview(days = 30) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [{ data: jobs }, { data: workspaces }, { data: members }, { data: projects }, { data: notices }] = await Promise.all([
    admin.from("ai_jobs").select("workspace_id, project_id, task, provider, model, status, cost_usd, seconds, fallback_from, error, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    admin.from("workspaces").select("id, name, created_at").order("created_at"),
    admin.from("members").select("workspace_id"),
    admin.from("projects").select("workspace_id"),
    admin.from("notifications").select("id, workspace_id, kind, title, body, created_at").order("created_at", { ascending: false }).limit(50),
  ]);
  return { jobs: (jobs ?? []) as Job[], workspaces: workspaces ?? [], members: members ?? [], projects: projects ?? [], notices: notices ?? [] };
}

// One workspace's own use, for its Credits page. Read through RLS.
export async function workspaceUsage(workspaceId: string, days = 30) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [{ data: jobs }, { data: projects }] = await Promise.all([
    supabase.from("ai_jobs").select("workspace_id, project_id, task, provider, model, status, cost_usd, seconds, fallback_from, error, created_at").eq("workspace_id", workspaceId).gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
    supabase.from("projects").select("id, name").eq("workspace_id", workspaceId),
  ]);
  return { jobs: (jobs ?? []) as Job[], projects: projects ?? [] };
}
