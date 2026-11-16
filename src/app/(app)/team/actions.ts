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

// ---------- Crew directory (M6) ----------
// ID numbers never pass through these as plain columns: they go to set_crew_id, which encrypts
// them in the database, and come back only through reveal_crew_id, which logs every view.

type CrewResult = { error?: string; value?: string | null };
const CREW_FIELDS = ["name", "role", "department", "phone", "email", "gamr_status", "gamr_number", "notes"] as const;
const GAMR = ["registered", "pending", "not_registered", "unknown"];

export async function addCrew(input: { name: string; role?: string; department?: string; phone?: string; gamr_status?: string }): Promise<CrewResult> {
  const me = await getCurrentMember();
  if (!me || !["admin", "producer", "coordinator"].includes(me.role)) return { error: "Only editors can change the crew." };
  const name = input.name?.trim().slice(0, 120);
  if (!name) return { error: "Add a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("crew").insert({
    workspace_id: me.workspace.id,
    name,
    role: input.role?.trim().slice(0, 120) || null,
    department: input.department?.slice(0, 60) || null,
    phone: input.phone?.trim().slice(0, 40) || null,
    gamr_status: GAMR.includes(input.gamr_status ?? "") ? input.gamr_status : "unknown",
  });
  if (error) return { error: error.message };
  revalidatePath("/team");
  return {};
}

export async function updateCrew(id: string, patch: Partial<Record<(typeof CREW_FIELDS)[number], string>>): Promise<CrewResult> {
  const me = await getCurrentMember();
  if (!me || !["admin", "producer", "coordinator"].includes(me.role)) return { error: "Only editors can change the crew." };
  const row: Record<string, string | null> = {};
  for (const k of CREW_FIELDS) if (k in patch) row[k] = (patch[k] ?? "").trim().slice(0, k === "notes" ? 2000 : 200) || null;
  if ("gamr_status" in row && !GAMR.includes(row.gamr_status ?? "")) row.gamr_status = "unknown";
  if ("name" in row && !row.name) return { error: "Add a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("crew").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", me.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return {};
}

export async function deleteCrew(id: string): Promise<CrewResult> {
  const me = await getCurrentMember();
  if (!me || !["admin", "producer", "coordinator"].includes(me.role)) return { error: "Only editors can change the crew." };
  const supabase = await createClient();
  const { error } = await supabase.from("crew").delete().eq("id", id).eq("workspace_id", me.workspace.id);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return {};
}

export async function setCrewId(id: string, value: string): Promise<CrewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_crew_id", { p_crew: id, id_number: value });
  if (error) return { error: error.message.includes("10 digits") ? "A national ID or iqama number has 10 digits and starts with 1 or 2." : "Not allowed." };
  revalidatePath("/team");
  return {};
}

// Admins and Coordinators only; the database logs the view.
export async function revealCrewId(id: string): Promise<CrewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_crew_id", { p_crew: id, purpose: "view" });
  if (error) return { error: "Only Admins and Coordinators can see full ID numbers." };
  return { value: (data as string | null) ?? null };
}
