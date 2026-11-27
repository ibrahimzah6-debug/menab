import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberships } from "@/lib/workspace";

// One stable address per stored file. Only members of the file's workspace get it: they are sent
// on to a private link that works for an hour. The browser keeps this answer for 50 minutes, and
// Supabase lets it keep the file, so a picture is downloaded about once an hour, not on every refresh.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const path = parts.map(decodeURIComponent).join("/");
  if (!path || path.includes("..")) return new NextResponse("Not found", { status: 404 });
  const workspaceId = path.split("/")[0];
  const mine = (await getMemberships()).some((m) => m.workspace.id === workspaceId);
  if (!mine) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient().storage.from("media").createSignedUrl(path, 3600);
  if (!data?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "private, max-age=3000" } });
}
