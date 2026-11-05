"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getMemberships, WORKSPACE_COOKIE } from "@/lib/workspace";

const YEAR = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark" | "system";

export async function setTheme(theme: Theme) {
  const value = theme === "dark" || theme === "system" ? theme : "light";
  (await cookies()).set("menab-theme", value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setSidebar(open: boolean) {
  (await cookies()).set("menab-sidebar", open ? "open" : "closed", { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function switchWorkspace(workspaceId: string) {
  // Only workspaces the person belongs to.
  const all = await getMemberships();
  if (!all.some((m) => m.workspace.id === workspaceId)) return;
  (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}
