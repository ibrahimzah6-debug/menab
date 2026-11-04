"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The token is only used when the person presses Accept. Link previews in WhatsApp
// or a phone opening the page twice can no longer use it up.
export async function acceptInvite(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "") as EmailOtpType;
  if (!tokenHash || (type !== "invite" && type !== "magiclink")) redirect("/login?error=link");

  const supabase = await createClient();
  // Someone else may be logged in on this browser, for example the Admin testing the link.
  await supabase.auth.signOut({ scope: "local" });
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) redirect("/login?error=link");
  redirect("/auth/set-password");
}
