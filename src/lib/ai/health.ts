import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Model health, across all workspaces: a model whose last calls in the past 30 minutes all
// failed (or were taken over by the backup) is skipped, and the backup answers straight away.
// After 30 quiet minutes it gets another chance, so a model that recovers comes back by itself.

const WINDOW_MIN = 30;
const cache = new Map<string, { at: number; failing: boolean }>();

export async function isFailing(modelId: string): Promise<boolean> {
  const hit = cache.get(modelId);
  if (hit && Date.now() - hit.at < 60_000) return hit.failing;
  let failing = false;
  try {
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
    const { data } = await createAdminClient()
      .from("ai_jobs")
      .select("model, fallback_from, status")
      .gte("created_at", since)
      .or(`model.eq.${modelId},fallback_from.eq.${modelId}`)
      .order("created_at", { ascending: false })
      .limit(4);
    const rows = data ?? [];
    const bad = (r: { model: string; fallback_from: string | null; status: string }) => r.fallback_from === modelId || (r.model === modelId && r.status === "failed");
    failing = rows.length >= 2 && rows.slice(0, 2).every(bad);
  } catch {
    failing = false;
  }
  cache.set(modelId, { at: Date.now(), failing });
  return failing;
}

// The last 24 hours per model, for the owner dashboard.
export async function modelHealth() {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await createAdminClient()
    .from("ai_jobs")
    .select("model, fallback_from, status, seconds, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  const by = new Map<string, { ok: number; failed: number; tookOver: number; seconds: number[]; last?: string }>();
  const get = (m: string) => by.get(m) ?? (by.set(m, { ok: 0, failed: 0, tookOver: 0, seconds: [] }), by.get(m)!);
  for (const r of data ?? []) {
    const m = get(r.model);
    if (r.status === "success") m.ok++;
    else m.failed++;
    if (r.seconds != null) m.seconds.push(Number(r.seconds));
    m.last ??= r.created_at;
    if (r.fallback_from) get(r.fallback_from).tookOver++;
  }
  return [...by.entries()].map(([model, v]) => ({
    model,
    ok: v.ok,
    failed: v.failed + v.tookOver,
    avgSeconds: v.seconds.length ? Math.round((v.seconds.reduce((a, b) => a + b, 0) / v.seconds.length) * 10) / 10 : null,
    last: v.last ?? null,
  }));
}
