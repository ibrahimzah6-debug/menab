import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

// /api/cron is called by Vercel's scheduler with its own secret, not a login.
// /welcome is the public website; a visitor who is not signed in sees it at "/".
const PUBLIC_PATHS = ["/login", "/auth", "/api/cron", "/welcome"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not run code between createServerClient and getClaims.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!signedIn && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    const rewrite = NextResponse.rewrite(url);
    response.cookies.getAll().forEach((c) => rewrite.cookies.set(c));
    return rewrite;
  }
  if (!signedIn && !isPublic) {
    // The AI endpoints answer a plain "log in" instead of sending back the login page.
    const isEndpoint = path.startsWith("/api/") || /^\/p\/[^/]+\/(brief|voice|creative|documents|look|frames|generate|preprod)$/.test(path);
    if (isEndpoint) return NextResponse.json({ error: "Log in again." }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path === "/start" ? "?next=/start" : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
