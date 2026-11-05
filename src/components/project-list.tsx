import Link from "next/link";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { stageNumbersFor, type Path } from "@/lib/projects";
import { stagesFor } from "@/lib/stages";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/lib/workspace";

export async function ProjectList({ limit }: { limit?: number }) {
  const { locale, t } = await getI18n();
  const supabase = await createClient();
  const me = await getCurrentMember();
  if (!me) return null;
  let q = supabase
    .from("projects")
    .select("id, name, client, path, current_stage, updated_at")
    .eq("workspace_id", me.workspace.id)
    .order("updated_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  if (!data?.length) return <p className="body text-ink-muted m-0">{t.projects.empty}</p>;

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
      {data.map((p) => {
        const path = p.path as Path | null;
        const order = stageNumbersFor(path);
        const names = stagesFor(path ?? "none", t.stage.names);
        const idx = Math.max(0, order.indexOf(p.current_stage));
        return (
          <Link key={p.id} href={`/p/${p.id}`} className="bg-surface border border-line rounded-md p-4 flex flex-col gap-2 hover:border-line-strong">
            <div className="flex items-center justify-between gap-2">
              <span className="mn-label">{fill(t.projects.stageOf, { n: idx + 1, total: order.length })}</span>
              <span className="mn-chip mn-chip--ready">{path ? t.stage.paths[path] : t.stage.paths.none}</span>
            </div>
            <span className="h3">{p.name}</span>
            <span className="small text-ink-muted">{[p.client, names[idx]].filter(Boolean).join(" · ")}</span>
            <span className="small text-ink-faint">
              {fill(t.projects.updated, {
                date: new Date(p.updated_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-GB", { day: "numeric", month: "short" }),
              })}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
