"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

// Browser client, used only to upload files straight to storage with a one-time upload link
// the server hands out. Row-level security applies to everything else.
let client: ReturnType<typeof createBrowserClient> | null = null;
export function browserClient() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
