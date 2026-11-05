"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";

type Result = { error?: string };

export type LibraryTable = "brand_kits" | "characters" | "locations";

const MAX_FILE = 50 * 1024 * 1024;
const TYPES = /^(image\/(png|jpeg|webp|gif|svg\+xml)|application\/pdf|audio\/(mpeg|mp3|wav|x-wav|mp4|x-m4a|aac)|video\/(mp4|quicktime|webm))$/;

// The fields each library item may change. Anything else sent is ignored.
const FIELDS: Record<LibraryTable, Record<string, "text" | "list" | "kind">> = {
  brand_kits: { name: "text", logo_path: "text", colors: "list", fonts: "list", tone: "text", notes: "text" },
  characters: { name: "text", description: "text", age: "text", look: "text", wardrobe: "text", voice: "text", image_paths: "list" },
  locations: { name: "text", description: "text", city: "text", kind: "kind", image_paths: "list" },
};

async function editor() {
  const me = await getCurrentMember();
  if (!me) throw new Error("Log in again.");
  if (!["admin", "producer", "coordinator"].includes(me.role)) throw new Error("Viewers can look at the libraries but not change them.");
  return me;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const own = (path: string, ws: string) => path.startsWith(`${ws}/library/`) && !path.includes("..");

// Files go straight from the browser to storage with a one-time upload link.
export async function prepareLibraryUpload(name: string, mime: string, size: number): Promise<{ path?: string; token?: string; error?: string }> {
  try {
    const me = await editor();
    if (!TYPES.test(mime)) return { error: "This file type is not supported." };
    if (size > MAX_FILE) return { error: "Files must be under 50 MB." };
    const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "file";
    const path = `${me.workspace.id}/library/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
    const { data, error } = await createAdminClient().storage.from("media").createSignedUploadUrl(path);
    if (error || !data) return { error: "Could not start the upload. Try again." };
    return { path: data.path, token: data.token };
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function saveLibraryItem(table: LibraryTable, id: string | null, input: Record<string, unknown>): Promise<Result & { id?: string }> {
  try {
    const me = await editor();
    const allowed = FIELDS[table];
    if (!allowed) return { error: "Unknown library." };
    const row: Record<string, unknown> = {};
    for (const [k, type] of Object.entries(allowed)) {
      if (!(k in input)) continue;
      const v = input[k];
      if (type === "list") {
        const list = (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12);
        if (k === "image_paths" && list.some((p) => !own(p, me.workspace.id))) return { error: "File not found." };
        row[k] = list;
      } else if (type === "kind") {
        row[k] = ["real", "ai", "either"].includes(String(v)) ? v : null;
      } else {
        const text = String(v ?? "").trim();
        if (k === "logo_path" && text && !own(text, me.workspace.id)) return { error: "File not found." };
        row[k] = text ? text.slice(0, 4000) : null;
      }
    }
    if (!id && !row.name) return { error: "Give it a name." };
    if ("name" in row && !row.name) return { error: "Give it a name." };
    const supabase = await createClient();
    if (id) {
      const { error } = await supabase.from(table).update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", me.workspace.id);
      if (error) return { error: "Could not save. Try again." };
      revalidatePath("/libraries");
      return { id };
    }
    const { data, error } = await supabase.from(table).insert({ ...row, workspace_id: me.workspace.id }).select("id").single();
    if (error || !data) return { error: "Could not save. Try again." };
    revalidatePath("/libraries");
    return { id: data.id };
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function removeLibraryItem(table: LibraryTable | "assets", id: string): Promise<Result> {
  try {
    const me = await editor();
    const supabase = await createClient();
    const cols = table === "assets" ? "path" : table === "brand_kits" ? "logo_path" : "image_paths";
    const { data } = await supabase.from(table).select(cols).eq("id", id).eq("workspace_id", me.workspace.id).maybeSingle();
    const { error } = await supabase.from(table).delete().eq("id", id).eq("workspace_id", me.workspace.id);
    if (error) return { error: "Could not remove it. Try again." };
    // Remove the files too, when nothing else in the library points to them.
    const row = (data ?? {}) as Record<string, unknown>;
    const paths = ([] as unknown[]).concat(row[cols] ?? []).filter((p): p is string => typeof p === "string" && own(p, me.workspace.id));
    if (paths.length) await createAdminClient().storage.from("media").remove(paths);
    revalidatePath("/libraries");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function addAssets(files: { path: string; name: string; mime: string; size: number }[]): Promise<Result> {
  try {
    const me = await editor();
    const rows = files.slice(0, 20).map((f) => {
      if (!own(f.path, me.workspace.id)) throw new Error("File not found.");
      const kind = f.mime.startsWith("audio/") ? "music" : f.mime.startsWith("video/") ? "footage" : f.mime === "application/pdf" ? "document" : "other";
      return { workspace_id: me.workspace.id, path: f.path, name: f.name.slice(0, 200) || "file", mime: f.mime, size_bytes: Math.max(0, Math.round(f.size)), kind };
    });
    if (!rows.length) return {};
    const { error } = await (await createClient()).from("assets").insert(rows);
    if (error) return { error: "Could not save the files. Try again." };
    revalidatePath("/libraries");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}

export async function updateAsset(id: string, patch: { name?: string; kind?: string }): Promise<Result> {
  try {
    const me = await editor();
    const row: Record<string, unknown> = {};
    if (patch.name?.trim()) row.name = patch.name.trim().slice(0, 200);
    if (patch.kind && ["logo", "product", "reference", "music", "footage", "document", "other"].includes(patch.kind)) row.kind = patch.kind;
    if (!Object.keys(row).length) return {};
    const { error } = await (await createClient()).from("assets").update(row).eq("id", id).eq("workspace_id", me.workspace.id);
    if (error) return { error: "Could not save. Try again." };
    revalidatePath("/libraries");
    return {};
  } catch (e) {
    return { error: errText(e) };
  }
}
