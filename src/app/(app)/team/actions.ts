"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember, type Role } from "@/lib/workspace";

const ROLES: Role[] = ["admin", "producer", "coordinator", "viewer"];

export type TeamError = "adminOnly" | "badEmail" | "alreadyMember" | "lastAdmin" | "failed";
export type InviteState = { error?: TeamError; link?: string; email?: string } | undefined;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function requireAdmin() {
  const me = await getCurrentMember();
  return me && me.role === "admin" ? me : null;
}

// Makes a one-time login link without sending email. The Admin shares it on WhatsApp or email.
async function makeLink(email: string, fullName?: string) {
  const admin = createAdminClient();
  let result = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });
  let type: "invite" | "magiclink" = "invite";
  if (result.error) {
    // The person already has a Menab login (for example, invited before). Give them a login link instead.
    result = await admin.auth.admin.generateLink({ type: "magiclink", email });
    type = "magiclink";
  }
  if (result.error || !result.data.user) return null;
  const params = new URLSearchParams({ token_hash: result.data.properties.hashed_token, type });
  return { userId: result.data.user.id, link: `${await origin()}/auth/confirm?${params}` };
}

export async function inviteMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const me = await requireAdmin();
  if (!me) return { error: "adminOnly" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  const role = String(formData.get("role") ?? "viewer") as Role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "badEmail" };
  if (!ROLES.includes(role)) return { error: "failed" };

  try {
    const made = await makeLink(email, fullName || undefined);
    if (!made) return { error: "failed" };

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("members")
      .select("id")
      .eq("workspace_id", me.workspace.id)
      .eq("user_id", made.userId)
      .maybeSingle();
    if (existing) return { error: "alreadyMember" };

    const { error } = await admin.from("members").insert({
      workspace_id: me.workspace.id,
      user_id: made.userId,
      email,
      full_name: fullName || null,
      role,
      invited_by: me.userId,
    });
    if (error) return { error: "failed" };

    revalidatePath("/team");
    return { link: made.link, email };
  } catch {
    return { error: "failed" };
  }
}

export async function newInviteLink(memberId: string): Promise<InviteState> {
  const me = await requireAdmin();
  if (!me) return { error: "adminOnly" };
  // Read through RLS so an Admin can only reach people in their own workspace.
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("email, workspace_id")
    .eq("id", memberId)
    .eq("workspace_id", me.workspace.id)
    .maybeSingle();
  if (!member) return { error: "failed" };
  try {
    const made = await makeLink(member.email);
    if (!made) return { error: "failed" };
    return { link: made.link, email: member.email };
  } catch {
    return { error: "failed" };
  }
}

export async function changeRole(memberId: string, role: Role): Promise<{ error?: TeamError }> {
  if (!(await requireAdmin())) return { error: "adminOnly" };
  if (!ROLES.includes(role)) return { error: "failed" };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("members")
    .update({ role }, { count: "exact" })
    .eq("id", memberId);
  revalidatePath("/team");
  if (error) return { error: error.message.includes("at least one Admin") ? "lastAdmin" : "failed" };
  if (!count) return { error: "failed" };
  return {};
}

export async function removeMember(memberId: string): Promise<{ error?: TeamError }> {
  if (!(await requireAdmin())) return { error: "adminOnly" };
  const supabase = await createClient();
  const { error, count } = await supabase.from("members").delete({ count: "exact" }).eq("id", memberId);
  revalidatePath("/team");
  if (error) return { error: error.message.includes("at least one Admin") ? "lastAdmin" : "failed" };
  if (!count) return { error: "failed" };
  return {};
}
