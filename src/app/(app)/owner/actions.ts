"use server";

import { revalidatePath } from "next/cache";
import { clearRulesCache, runAnalysis } from "@/lib/dev";
import { ensureTranslation, MACHINE_LOCALES } from "@/lib/i18n/translate";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/usage";

type Result = { error?: string };

async function owner() {
  if (!(await isPlatformAdmin())) throw new Error("Only Menab's owners can do this.");
  return createAdminClient();
}
const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export async function runAnalysisNow(): Promise<Result> {
  try {
    await owner();
    const { locale } = await getI18n();
    await runAnalysis(locale);
    revalidatePath("/owner");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

// Accepting a rule turns it on for every Menab AI call.
export async function setItemStatus(id: string, status: "open" | "accepted" | "done" | "dismissed"): Promise<Result> {
  try {
    const admin = await owner();
    if (!["open", "accepted", "done", "dismissed"].includes(status)) return { error: "Unknown status." };
    const { data: item } = await admin.from("dev_items").select("id, kind, detail, title").eq("id", id).maybeSingle();
    if (!item) return { error: "Not found." };
    await admin.from("dev_items").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (item.kind === "prompt_rule") {
      const on = status === "accepted" || status === "done";
      const { data: rule } = await admin.from("ai_rules").select("id").eq("source_item", id).maybeSingle();
      if (rule) await admin.from("ai_rules").update({ active: on }).eq("id", rule.id);
      else if (on) await admin.from("ai_rules").insert({ text: String(item.detail || item.title).slice(0, 500), source_item: id });
      clearRulesCache();
    }
    revalidatePath("/owner");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function addRule(text: string): Promise<Result> {
  try {
    const admin = await owner();
    const clean = text.trim().slice(0, 500);
    if (!clean) return {};
    await admin.from("ai_rules").insert({ text: clean });
    clearRulesCache();
    revalidatePath("/owner");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function setRule(id: string, active: boolean | null): Promise<Result> {
  try {
    const admin = await owner();
    if (active === null) await admin.from("ai_rules").delete().eq("id", id);
    else await admin.from("ai_rules").update({ active }).eq("id", id);
    clearRulesCache();
    revalidatePath("/owner");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function prepareAllLanguages(): Promise<Result> {
  try {
    await owner();
    const errors: string[] = [];
    for (const l of Object.keys(MACHINE_LOCALES)) {
      const r = await ensureTranslation(l);
      if (!r.ok && r.error) errors.push(`${MACHINE_LOCALES[l].name}: ${r.error}`);
    }
    revalidatePath("/owner");
    return errors.length ? { error: errors.join(" | ") } : {};
  } catch (e) {
    return { error: errText(e) };
  }
}
