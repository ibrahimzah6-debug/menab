import "server-only";
import { z } from "zod";
import { structured } from "@/lib/ai/brain-core";
import { modelHealth } from "@/lib/ai/health";
import { createAdminClient } from "@/lib/supabase/admin";

// The development loop. Every day (and whenever the owner asks), an AI analyst reads how Menab
// was used: which models failed or were slow, what people edited by hand after the AI wrote
// it, thumbs down and ideas, notices. It writes a short report and a list of proposed fixes and
// features. The owner accepts, finishes or dismisses each one. A proposal of kind "prompt_rule"
// becomes, once accepted, a rule that Menab AI follows on every call from then on.

const ANALYST_MODEL = "gpt-6-1-sol";

let rulesCache: { at: number; rules: string[] } | null = null;

// The lessons the owner approved, added to Menab AI's instructions.
export async function activeRules(): Promise<string[]> {
  if (rulesCache && Date.now() - rulesCache.at < 60_000) return rulesCache.rules;
  try {
    const { data } = await createAdminClient().from("ai_rules").select("text").eq("active", true).order("created_at").limit(40);
    rulesCache = { at: Date.now(), rules: (data ?? []).map((r) => r.text as string) };
  } catch {
    rulesCache = { at: Date.now(), rules: [] };
  }
  return rulesCache.rules;
}
export function clearRulesCache() {
  rulesCache = null;
}

const Report = z.object({
  summary: z.string().describe("4 to 8 short sentences: how Menab is doing, what hurts people most, what improved since the last report."),
  items: z
    .array(
      z.object({
        title: z.string().describe("A short imperative title, e.g. 'Stop asking for the budget twice'"),
        detail: z.string().describe("What to change and how, concrete enough for a developer or for Menab's instructions."),
        evidence: z.string().describe("The numbers or quotes from the data that show the problem."),
        kind: z.enum(["fix", "feature", "prompt_rule", "model", "design"]).describe("prompt_rule: a one-line instruction Menab AI should follow from now on (put that line in detail). model: change the default or backup model. fix: a bug. feature: something new people asked for. design: the screens."),
        priority: z.enum(["high", "medium", "low"]),
      }),
    )
    .describe("At most 8 items, most important first. Skip anything already in the open list or the active rules."),
});

export async function runAnalysis(language: "en" | "ar" = "en") {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [{ data: jobs }, { data: notices }, { data: feedback }, { data: edits }, { data: open }, rules, health] = await Promise.all([
    admin.from("ai_jobs").select("task, model, status, seconds, cost_usd, fallback_from, error").gte("created_at", since).limit(3000),
    admin.from("notifications").select("kind, title, body").gte("created_at", since).order("created_at", { ascending: false }).limit(40),
    admin.from("feedback").select("kind, text, page, message_id").gte("created_at", since).order("created_at", { ascending: false }).limit(80),
    admin.from("versions").select("source, output_id").gte("created_at", since).limit(3000),
    admin.from("dev_items").select("title, status").in("status", ["open", "accepted"]).limit(60),
    activeRules(),
    modelHealth(),
  ]);

  // The replies people rated, with what they said.
  const rated = (feedback ?? []).filter((f) => f.message_id).map((f) => f.message_id as string);
  const { data: replies } = rated.length ? await admin.from("messages").select("id, content").in("id", rated) : { data: [] };

  const byTask: Record<string, { calls: number; failed: number; avgSeconds: number; cost: number }> = {};
  for (const j of jobs ?? []) {
    const t = (byTask[j.task] ??= { calls: 0, failed: 0, avgSeconds: 0, cost: 0 });
    t.calls++;
    if (j.status === "failed") t.failed++;
    t.avgSeconds += Number(j.seconds ?? 0);
    t.cost += Number(j.cost_usd ?? 0);
  }
  for (const t of Object.values(byTask)) t.avgSeconds = Math.round((t.avgSeconds / Math.max(1, t.calls)) * 10) / 10;
  const stats = {
    days: 7,
    calls: jobs?.length ?? 0,
    byTask,
    models: health,
    handEdits: (edits ?? []).filter((v) => v.source === "edit").length,
    aiVersions: (edits ?? []).filter((v) => v.source === "ai").length,
    thumbsUp: (feedback ?? []).filter((f) => f.kind === "up").length,
    thumbsDown: (feedback ?? []).filter((f) => f.kind === "down").length,
  };

  const data = {
    stats,
    recentErrors: (jobs ?? []).filter((j) => j.error).slice(0, 25).map((j) => `${j.model}: ${String(j.error).slice(0, 200)}`),
    notices: (notices ?? []).map((n) => `${n.kind}: ${n.title}${n.body ? ` (${String(n.body).slice(0, 160)})` : ""}`),
    feedback: (feedback ?? []).map((f) => ({
      kind: f.kind,
      said: f.text,
      page: f.page,
      reply: f.message_id ? (replies ?? []).find((r) => r.id === f.message_id)?.content?.slice(0, 400) : undefined,
    })),
    alreadyOpen: (open ?? []).map((i) => `${i.status}: ${i.title}`),
    activeRules: rules,
  };

  const r = await structured(
    ANALYST_MODEL,
    `You are the product development analyst for Menab, a Saudi web app that takes a video from brief to delivery with AI, a production house, or both. Its users are producers at ZAH Production Services in Riyadh, working in Arabic and English. Menab AI runs the brief chat and writes the stage documents.
Read a week of usage data and propose what to improve. Be specific and practical. Prefer fixes that make answers better, faster and cheaper, and that remove friction people complained about. A prompt_rule is the cheapest fix: one clear line Menab AI will follow on every call. Never propose anything that sends national ID or iqama numbers to an AI. No em dashes. Write in ${language === "ar" ? "Arabic" : "English"}.`,
    [{ role: "user", content: `Usage data (JSON):\n${JSON.stringify(data)}` }],
    Report,
    { effort: "medium", maxTokens: 6000, timeoutMs: 120_000 },
  );

  const { data: report } = await admin.from("dev_reports").insert({ model: r.model, summary: r.data.summary.slice(0, 8000), stats }).select("id").single();
  const items = r.data.items.slice(0, 8).map((i) => ({
    report_id: report?.id ?? null,
    title: i.title.slice(0, 200),
    detail: i.detail.slice(0, 4000),
    evidence: i.evidence.slice(0, 2000),
    kind: i.kind,
    priority: i.priority,
  }));
  if (items.length) await admin.from("dev_items").insert(items);
  return { reportId: report?.id, items: items.length };
}

// Runs the analyst when the last report is more than a day old (called after the owner
// dashboard opens, and by the daily schedule).
let running = false;
export async function analyseIfStale(language: "en" | "ar" = "en") {
  if (running) return;
  running = true;
  try {
    const { data } = await createAdminClient().from("dev_reports").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!data || Date.now() - new Date(data.created_at).getTime() > 24 * 3600_000) await runAnalysis(language);
  } catch {
    // Not urgent: tried again next time.
  } finally {
    running = false;
  }
}
