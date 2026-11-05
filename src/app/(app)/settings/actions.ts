"use server";

import { revalidatePath } from "next/cache";
import { CATALOG, TEXT_MODELS, type ModelTask } from "@/lib/ai/catalog";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";

export async function saveDefaultModel(task: ModelTask | "text", modelId: string): Promise<{ error?: string }> {
  const me = await getCurrentMember();
  if (!me || me.role !== "admin") return { error: "Only an Admin can change the default model." };
  const list = task === "text" ? TEXT_MODELS : CATALOG[task as ModelTask];
  if (!list || !list.some((m) => m.id === modelId)) return { error: "Unknown model" };
  const supabase = await createClient();
  const { error } = await supabase.from("model_settings").upsert({
    workspace_id: me.workspace.id,
    task,
    model_id: modelId,
    updated_by: me.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save. Try again." };
  revalidatePath("/settings");
  return {};
}
