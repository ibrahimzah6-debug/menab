"use server";

import { revalidatePath } from "next/cache";
import { createTask, getCredits, getTask, KIE_USD_PER_CREDIT, KieError } from "@/lib/ai/kie";
import { findModel, itemsForPhase, modelsForStep, PLAN, type Phase } from "@/lib/ai/provider-test-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";

export type ActionResult = { error?: string; started?: number; pending?: number };

async function requireAdmin() {
  const me = await getCurrentMember();
  return me && me.role === "admin" ? me : null;
}

function errText(e: unknown) {
  if (e instanceof KieError) return `${e.code}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}

// Expiring links to our own copies of earlier results, used as references for the next step.
async function referenceUrls(workspaceId: string, run: number, keys: string[]) {
  const admin = createAdminClient();
  const urls: string[] = [];
  for (const key of keys) {
    const { data } = await admin
      .from("provider_test_items")
      .select("file_path, source_url")
      .eq("workspace_id", workspaceId)
      .eq("run_number", run)
      .eq("item_key", key)
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { missing: key };
    if (data.file_path) {
      const { data: signed } = await admin.storage.from("media").createSignedUrl(data.file_path, 60 * 60);
      if (signed?.signedUrl) {
        urls.push(signed.signedUrl);
        continue;
      }
    }
    if (data.source_url) urls.push(data.source_url);
    else return { missing: key };
  }
  return { urls };
}

async function launch(
  workspaceId: string,
  userId: string,
  run: number,
  itemKey: string,
  providerModel: string,
) {
  const item = PLAN.find((p) => p.key === itemKey);
  const model = findModel(providerModel);
  if (!item || !model) return "Unknown test item";
  const refs = await referenceUrls(workspaceId, run, item.uses);
  if ("missing" in refs) return `Generate ${refs.missing} first`;

  const input = model.build(item.prompt, refs.urls ?? []);
  const row = {
    workspace_id: workspaceId,
    run_number: run,
    step: item.step,
    item_key: item.key,
    model: model.label,
    provider_model: model.providerModel,
    prompt: item.prompt,
    request: input,
    created_by: userId,
  };
  const admin = createAdminClient();
  try {
    const taskId = await createTask(model.providerModel, input);
    await admin.from("provider_test_items").insert({ ...row, task_id: taskId, status: "generating" });
    return null;
  } catch (e) {
    // A job Kie refuses still counts against its success rate.
    await admin.from("provider_test_items").insert({
      ...row,
      status: "failed",
      fail_reason: errText(e),
      finished_at: new Date().toISOString(),
    });
    return errText(e);
  }
}

export async function startPhase(run: number, phase: Phase): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!me) return { error: "Only an Admin can run the provider test." };
  if (!Number.isInteger(run) || run < 1) return { error: "Unknown run" };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("provider_test_items")
    .select("item_key, provider_model, status")
    .eq("workspace_id", me.workspace.id)
    .eq("run_number", run);

  let started = 0;
  let lastError: string | null = null;
  for (const item of itemsForPhase(phase)) {
    for (const model of modelsForStep(item.step)) {
      const already = (existing ?? []).some(
        (r) => r.item_key === item.key && r.provider_model === model.providerModel && r.status !== "failed",
      );
      if (already) continue;
      const err = await launch(me.workspace.id, me.userId, run, item.key, model.providerModel);
      if (err) lastError = err;
      else started++;
    }
  }
  revalidatePath("/provider-test");
  return lastError ? { error: lastError, started } : { started };
}

export async function startNewRun(): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!me) return { error: "Only an Admin can run the provider test." };
  const admin = createAdminClient();
  const { data } = await admin
    .from("provider_test_items")
    .select("run_number")
    .eq("workspace_id", me.workspace.id)
    .order("run_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return startPhase((data?.run_number ?? 0) + 1, "references");
}

export async function retryItem(id: string): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!me) return { error: "Only an Admin can run the provider test." };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("provider_test_items")
    .select("run_number, item_key, provider_model")
    .eq("id", id)
    .eq("workspace_id", me.workspace.id)
    .maybeSingle();
  if (!row) return { error: "Unknown test item" };
  const err = await launch(me.workspace.id, me.userId, row.run_number, row.item_key, row.provider_model);
  revalidatePath("/provider-test");
  return err ? { error: err } : { started: 1 };
}

function extension(url: string, contentType: string | null) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("mp4")) return "mp4";
  if (contentType?.includes("quicktime")) return "mov";
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : "bin";
}

// Asks Kie about jobs still running. Finished files are copied to our storage straight away,
// because Kie deletes them after about 14 days.
export async function checkProgress(): Promise<ActionResult> {
  const me = await requireAdmin();
  if (!me) return { error: "Only an Admin can run the provider test." };
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("provider_test_items")
    .select("id, run_number, item_key, provider_model, task_id, created_at")
    .eq("workspace_id", me.workspace.id)
    .eq("status", "generating")
    .order("created_at", { ascending: true })
    .limit(6);

  for (const r of rows ?? []) {
    if (!r.task_id) continue;
    try {
      const task = await getTask(r.task_id);
      const elapsed = (Date.now() - new Date(r.created_at).getTime()) / 1000;
      if (task.state === "success") {
        const url = task.resultUrls[0];
        if (!url) {
          await admin
            .from("provider_test_items")
            .update({ status: "failed", fail_reason: "Finished without a file", finished_at: new Date().toISOString() })
            .eq("id", r.id);
          continue;
        }
        const file = await fetch(url, { cache: "no-store" });
        if (!file.ok) throw new Error(`Could not download the result (HTTP ${file.status})`);
        const type = file.headers.get("content-type");
        const ext = extension(url, type);
        const path = `${me.workspace.id}/provider-test/run-${r.run_number}/${r.item_key}-${r.provider_model.replace(/[^a-z0-9]+/gi, "-")}-${r.id}.${ext}`;
        const buf = await file.arrayBuffer();
        const up = await admin.storage.from("media").upload(path, buf, {
          contentType: type ?? undefined,
          upsert: true,
        });
        if (up.error) throw new Error(`Could not save the file: ${up.error.message}`);
        await admin
          .from("provider_test_items")
          .update({
            status: "success",
            source_url: url,
            file_path: path,
            mime_type: type,
            credits: task.credits,
            cost_usd: task.credits == null ? null : Math.round(task.credits * KIE_USD_PER_CREDIT * 10000) / 10000,
            seconds: task.seconds ?? Math.round(elapsed),
            finished_at: new Date().toISOString(),
          })
          .eq("id", r.id);
      } else if (task.state === "fail") {
        await admin
          .from("provider_test_items")
          .update({
            status: "failed",
            fail_reason: task.failMsg ?? "Failed",
            credits: task.credits,
            seconds: task.seconds ?? Math.round(elapsed),
            finished_at: new Date().toISOString(),
          })
          .eq("id", r.id);
      } else if (elapsed > 30 * 60) {
        await admin
          .from("provider_test_items")
          .update({ status: "failed", fail_reason: "No result after 30 minutes", finished_at: new Date().toISOString() })
          .eq("id", r.id);
      }
    } catch (e) {
      // Leave it running; the next check tries again. Note the problem for the page.
      await admin.from("provider_test_items").update({ fail_reason: errText(e) }).eq("id", r.id);
    }
  }

  const { count } = await admin
    .from("provider_test_items")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", me.workspace.id)
    .eq("status", "generating");
  revalidatePath("/provider-test");
  return { pending: count ?? 0 };
}

export async function saveScore(
  id: string,
  field: "quality" | "consistency" | "arabic_text",
  value: number | null,
): Promise<ActionResult> {
  if (!["quality", "consistency", "arabic_text"].includes(field)) return { error: "Unknown score" };
  if (value !== null && !(Number.isInteger(value) && value >= 1 && value <= 5)) return { error: "Use 1 to 5" };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("provider_test_items")
    .update({ [field]: value }, { count: "exact" })
    .eq("id", id);
  if (error || !count) return { error: "Could not save the score" };
  revalidatePath("/provider-test");
  return {};
}

export async function saveNote(id: string, notes: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("provider_test_items")
    .update({ notes: notes.slice(0, 2000) || null })
    .eq("id", id);
  if (error) return { error: "Could not save the note" };
  return {};
}

export async function kieBalance(): Promise<{ usd?: number; error?: string }> {
  if (!(await requireAdmin())) return { error: "Only an Admin can see this." };
  try {
    const credits = await getCredits();
    return { usd: Math.round(credits * KIE_USD_PER_CREDIT * 100) / 100 };
  } catch (e) {
    return { error: errText(e) };
  }
}
