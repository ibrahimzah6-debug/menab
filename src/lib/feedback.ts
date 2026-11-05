"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";

// Feedback that feeds the development loop: thumbs on Menab's replies, ideas and problems.
export async function sendFeedback(input: { kind: "up" | "down" | "idea" | "bug"; text?: string; messageId?: string; projectId?: string; page?: string }): Promise<{ error?: string }> {
  if (!["up", "down", "idea", "bug"].includes(input.kind)) return { error: "Unknown feedback." };
  const supabase = await createClient();
  let workspaceId: string | undefined;
  if (input.projectId) {
    const { data } = await supabase.from("projects").select("workspace_id").eq("id", input.projectId).maybeSingle();
    workspaceId = data?.workspace_id;
  }
  workspaceId ??= (await getCurrentMember())?.workspace.id;
  if (!workspaceId) return { error: "Log in again." };
  const { error } = await supabase.from("feedback").insert({
    workspace_id: workspaceId,
    kind: input.kind,
    text: input.text?.trim().slice(0, 2000) || null,
    message_id: input.messageId ?? null,
    project_id: input.projectId ?? null,
    page: input.page?.slice(0, 300) ?? null,
  });
  if (error) return { error: "Could not send it. Try again." };
  return {};
}
