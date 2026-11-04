import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "producer" | "coordinator" | "viewer";

export type CurrentMember = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: Role;
  workspace: { id: string; name: string };
};

// The logged-in user and their workspace. One workspace per company in v1.
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("members")
    .select("id, user_id, email, full_name, role, workspace:workspaces(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data || !data.workspace) return null;
  const ws = Array.isArray(data.workspace) ? data.workspace[0] : data.workspace;
  return {
    id: data.id,
    userId: data.user_id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as Role,
    workspace: { id: ws.id, name: ws.name },
  };
});

export const getUserEmail = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
});
