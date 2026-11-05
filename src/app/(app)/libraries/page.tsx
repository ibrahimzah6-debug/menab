import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";
import { LibraryView, type LibItem, type LibTab } from "./library-view";

const TABS: LibTab[] = ["brand", "characters", "locations", "assets"];
const TABLE = { brand: "brand_kits", characters: "characters", locations: "locations", assets: "assets" } as const;

// Libraries: brand kits, characters, locations and files a company reuses on every project.
export default async function LibrariesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { t } = await getI18n();
  const l = t.libraries;
  const me = await getCurrentMember();
  if (!me) return null;
  const { tab: asked } = await searchParams;
  const tab = (TABS.includes(asked as LibTab) ? asked : "brand") as LibTab;
  const supabase = await createClient();

  const [{ data: rows }, ...counts] = await Promise.all([
    supabase.from(TABLE[tab]).select("*").eq("workspace_id", me.workspace.id).order("created_at", { ascending: false }).limit(200),
    ...TABS.map((x) => supabase.from(TABLE[x]).select("id", { count: "exact", head: true }).eq("workspace_id", me.workspace.id)),
  ]);
  const items = (rows ?? []) as LibItem[];

  // Every file is private; the page gets short-lived links to show them.
  const paths = items.flatMap((x) => [x.logo_path, x.path, ...(x.image_paths ?? [])]).filter((p): p is string => Boolean(p));
  const urls: Record<string, string> = {};
  if (paths.length) {
    try {
      const { data } = await createAdminClient().storage.from("media").createSignedUrls(paths, 3600);
      for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
    } catch {
      // Without links the cards still show names.
    }
  }

  return (
    <div className="max-w-[1200px] flex flex-col gap-6">
      <div>
        <h1 className="h1 m-0">{t.nav.libraries}</h1>
        <p className="body text-ink-muted m-0 mt-1 max-w-[680px]">{l.intro}</p>
      </div>
      <nav className="mn-stagebar" aria-label={t.nav.libraries}>
        {TABS.map((x, i) => (
          <Link key={x} href={`/libraries?tab=${x}`} aria-current={x === tab ? "page" : undefined} className={`mn-stage ${x === tab ? "mn-stage--current" : ""}`}>
            {l.tabs[x]}
            <span className="mn-stage__num">{counts[i]?.count ?? 0}</span>
          </Link>
        ))}
      </nav>
      <LibraryView key={tab} tab={tab} items={items} urls={urls} l={l} canEdit={["admin", "producer", "coordinator"].includes(me.role)} />
    </div>
  );
}
