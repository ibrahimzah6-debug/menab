"use server";

import { revalidatePath } from "next/cache";
import { CATALOG, TEXT_MODELS, type ModelTask } from "@/lib/ai/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
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

// ---------- Account ----------

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) throw new Error("Log in again.");
  return { supabase, uid };
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

// The name shows in every workspace the person belongs to.
export async function saveProfile(fullName: string): Promise<{ error?: string }> {
  try {
    const { uid } = await me();
    const name = fullName.trim().slice(0, 120) || null;
    const admin = createAdminClient();
    const { error } = await admin.from("members").update({ full_name: name }).eq("user_id", uid);
    if (error) return { error: "Could not save. Try again." };
    await admin.auth.admin.updateUserById(uid, { user_metadata: { full_name: name } });
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function prepareAvatarUpload(mime: string, size: number): Promise<{ path?: string; token?: string; error?: string }> {
  try {
    const { uid } = await me();
    if (!/^image\/(png|jpeg|webp)$/.test(mime)) return { error: "Use a PNG, JPG or WEBP photo." };
    if (size > 5 * 1024 * 1024) return { error: "The photo must be under 5 MB." };
    const path = `profiles/${uid}/avatar-${Date.now()}`;
    const { data, error } = await createAdminClient().storage.from("media").createSignedUploadUrl(path);
    if (error || !data) return { error: "Could not start the upload. Try again." };
    return { path: data.path, token: data.token };
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function setAvatar(path: string | null): Promise<{ error?: string }> {
  try {
    const { uid } = await me();
    if (path && !path.startsWith(`profiles/${uid}/`)) return { error: "Photo not found." };
    const admin = createAdminClient();
    const { data: old } = await admin.from("members").select("avatar_path").eq("user_id", uid);
    const { error } = await admin.from("members").update({ avatar_path: path }).eq("user_id", uid);
    if (error) return { error: "Could not save. Try again." };
    const stale = [...new Set((old ?? []).map((r) => r.avatar_path).filter((p): p is string => Boolean(p) && p !== path))];
    if (stale.length) await admin.storage.from("media").remove(stale);
    revalidatePath("/", "layout");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function changePassword(password: string): Promise<{ error?: string }> {
  if (password.length < 8) return { error: "Use at least 8 characters." };
  try {
    const { supabase } = await me();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function renameWorkspace(name: string): Promise<{ error?: string }> {
  const m = await getCurrentMember();
  if (!m || m.role !== "admin") return { error: "Only an Admin can change this." };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { error: "Give the workspace a name." };
  const { error } = await (await createClient()).from("workspaces").update({ name: clean }).eq("id", m.workspace.id);
  if (error) return { error: "Could not save. Try again." };
  revalidatePath("/", "layout");
  return {};
}
