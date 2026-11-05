"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getMemberships, WORKSPACE_COOKIE } from "@/lib/workspace";
import { isPlatformAdmin } from "@/lib/usage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const YEAR = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark" | "system";

export async function setTheme(theme: Theme) {
  const value = theme === "dark" || theme === "system" ? theme : "light";
  (await cookies()).set("menab-theme", value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setSidebar(open: boolean) {
  (await cookies()).set("menab-menu", open ? "open" : "closed", { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function switchWorkspace(workspaceId: string) {
  // Only workspaces the person belongs to.
  const all = await getMemberships();
  if (!all.some((m) => m.workspace.id === workspaceId)) return;
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// A new workspace (one per company). Only Menab's owners create them; the creator joins as Admin
// and can invite the company's people from Team.
export async function createWorkspace(name: string): Promise<{ error?: string }> {
  const clean = name.trim().slice(0, 120);
  if (!clean) return { error: "Give the workspace a name." };
  if (!(await isPlatformAdmin())) return { error: "Only Menab's owners can add workspaces for now." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub as string | undefined;
  const email = claims?.claims?.email as string | undefined;
  if (!uid || !email) return { error: "Log in again." };
  const admin = createAdminClient();
  const { data: ws, error } = await admin.from("workspaces").insert({ name: clean }).select("id").single();
  if (error || !ws) return { error: "Could not add the workspace. Try again." };
  const full = (await getMemberships())[0]?.fullName ?? null;
  const { error: mErr } = await admin
    .from("members")
    .insert({ workspace_id: ws.id, user_id: uid, email, full_name: full, role: "admin", status: "active" });
  if (mErr) {
    await admin.from("workspaces").delete().eq("id", ws.id);
    return { error: "Could not add the workspace. Try again." };
  }
  (await cookies()).set(WORKSPACE_COOKIE, ws.id, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
  return {};
}
