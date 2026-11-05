import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "producer" | "coordinator" | "viewer";

export type CurrentMember = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  avatarPath: string | null;
  role: Role;
  workspace: { id: string; name: string };
};

export const WORKSPACE_COOKIE = "menab-ws";

// Every workspace the logged-in person belongs to. One workspace per company;
// a person who works with several companies can switch between them.
export const getMemberships = cache(async (): Promise<CurrentMember[]> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return [];

  const { data } = await supabase
    .from("members")
    .select("id, user_id, email, full_name, avatar_path, role, workspace:workspaces(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return (data ?? [])
    .filter((m) => m.workspace)
    .map((m) => {
      const ws = Array.isArray(m.workspace) ? m.workspace[0] : m.workspace;
      return {
        id: m.id,
        userId: m.user_id,
        email: m.email,
        fullName: m.full_name,
        avatarPath: m.avatar_path,
        role: m.role as Role,
        workspace: { id: ws.id, name: ws.name },
      };
    });
});

// The workspace the person is working in now: the one they picked, else their first.
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const all = await getMemberships();
  if (!all.length) return null;
  const picked = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  return all.find((m) => m.workspace.id === picked) ?? all[0];
});

export const getUserEmail = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
});
