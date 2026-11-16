import Link from "next/link";
import { notFound } from "next/navigation";
import { IconFolder } from "@/components/icons";
import { loadDeck } from "@/lib/deck";
import { fill } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The project's files: the branded documents (saved as PDF) and every picture made so far.

export default async function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await loadDeck(id);
  if (!deck) notFound();
  const { t } = await getI18n();
  const f = t.files;
  const supabase = await createClient();

  // Every drawn picture, newest first, with a download link.
  const [{ data: frames }, { data: look }, { data: made }] = await Promise.all([
    supabase.from("frame_images").select("n, version, path, created_at").eq("project_id", id).eq("status", "ready").order("n").order("version", { ascending: false }),
    supabase.from("look_images").select("kind, key, version, path, created_at").eq("project_id", id).eq("status", "ready").order("kind").order("version", { ascending: false }),
    supabase.from("gen_assets").select("kind, key, version, path").eq("project_id", id).eq("status", "ready").order("kind").order("key").order("version", { ascending: false }),
  ]);
  const prefix = `${deck.project.workspace_id}/projects/${id}/`;
  const items = [
    ...(look ?? []).map((r) => ({ path: r.path as string, label: `${r.kind === "character" ? t.deck.character : t.deck.location}: ${r.key}`, file: `${r.kind}-${r.key}-v${r.version}`, group: r.kind === "character" ? "characters" : "locations" })),
    ...(frames ?? []).map((r) => ({ path: r.path as string, label: `${t.outputs[17]} ${String(r.n).padStart(2, "0")} · v${r.version}`, file: `frame-${r.n}-v${r.version}`, group: "storyboard" })),
    ...(made ?? []).map((r) => ({ path: r.path as string, label: `${r.kind === "music" ? t.generate.music : r.kind === "voice" ? r.key : r.kind === "sheet" ? `${t.generate.sheet}: ${r.key}` : r.kind === "outfit" ? `${t.generate.outfits}: ${r.key.replace("|", ", ")}` : fill(t.generate.shot, { n: r.key })} · v${r.version}`, file: `${r.kind}-${r.key}-v${r.version}`.replace(/[^a-z0-9\u0600-\u06ff-]+/gi, "-"), group: r.kind === "clip" ? "clips" : r.kind === "keyframe" ? "keyframes" : r.kind === "voice" || r.kind === "music" ? "sound" : "actors" })),
  ].filter((x) => x.path?.startsWith(prefix) && !x.path.includes(".."));
  const links = new Map<string, { view: string; download: string }>();
  try {
    const admin = createAdminClient();
    const [{ data: view }] = await Promise.all([admin.storage.from("media").createSignedUrls(items.map((x) => x.path), 3600)]);
    for (const v of view ?? []) if (v.path && v.signedUrl) links.set(v.path, { view: v.signedUrl, download: `${v.signedUrl}&download=` });
  } catch {
    // No links: the pictures list shows without images.
  }

  const docs = [
    { key: "look-book", name: t.deck.lookBook, note: fill(f.lookNote, { c: deck.characters.length, l: deck.locations.length }), ready: deck.characters.length + deck.locations.length > 0, pictures: [...deck.characters, ...deck.locations].filter((x) => x.picture).length, total: deck.characters.length + deck.locations.length },
    { key: "storyboard", name: t.deck.storyboard, note: fill(f.boardNote, { n: deck.storyboard.length }), ready: deck.storyboard.length > 0, pictures: deck.storyboard.filter((x) => x.picture).length, total: deck.storyboard.length },
    { key: "cps", name: "CPS", note: t.outputs[6], ready: Boolean(deck.extra.cps?.milestones?.length), pictures: 0, total: 0 },
    { key: "ppm", name: t.outputs[27], note: t.preprod.intro[27], ready: deck.extra.crew.length > 0 || deck.extra.schedule.length > 0 || deck.storyboard.length > 0, pictures: 0, total: 0 },
    ...deck.extra.callSheets.map((c) => ({ key: `call-sheet-${c.day}`, name: t.preprod.calls.day.replace("{n}", String(c.day)).replace("{total}", String(deck.extra.callSheets.length)), note: c.date, ready: true, pictures: 0, total: 0 })),
  ];
  const later = [t.outputs[10]];
  const groups = [
    { key: "characters", label: t.deck.characters },
    { key: "locations", label: t.deck.locations },
    { key: "storyboard", label: t.deck.storyboard },
    { key: "actors", label: t.outputs[34] },
    { key: "keyframes", label: t.outputs[35] },
    { key: "clips", label: t.outputs[36] },
    { key: "sound", label: t.outputs[37] },
  ];

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1200px] flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href={`/p/${id}`} className="small text-ink-muted hover:text-ink self-start">{fill(f.back, { name: deck.project.name })}</Link>
        <h1 className="h2 m-0 mt-1 flex items-center gap-2"><IconFolder size={22} />{f.title}</h1>
        <p className="small text-ink-muted m-0">{deck.brand.isMenab ? f.menabKit : fill(f.brandKit, { name: deck.brand.name })}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="mn-label m-0">{f.documents}</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {docs.map((d) => (
            <article key={d.key} className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="mn-label grow">PDF</span>
                <span className={`mn-chip ${d.ready ? "mn-chip--ready" : "mn-chip--waiting"}`}>{d.ready ? t.status.ready : t.status.waiting}</span>
              </div>
              <h3 className="h3 m-0">{d.name}</h3>
              <p className="small text-ink-muted m-0">{d.ready ? d.note : f.notYet}</p>
              {d.ready && d.pictures < d.total && <p className="text-[12px] text-ink-faint m-0">{fill(f.missingPictures, { n: d.total - d.pictures, total: d.total })}</p>}
              {d.ready && (
                <div className="flex flex-wrap gap-2 mt-auto">
                  <a href={`/print/${id}/${d.key}?print=1`} target="_blank" rel="noopener" className="mn-btn mn-btn--secondary mn-btn--sm">{f.savePdf}</a>
                  <a href={`/print/${id}/${d.key}`} target="_blank" rel="noopener" className="mn-btn mn-btn--ghost mn-btn--sm">{f.open}</a>
                </div>
              )}
            </article>
          ))}
          <article className="rounded-lg border border-dashed border-line-control p-5 flex flex-col gap-2">
            <span className="mn-label">{f.later}</span>
            <p className="small text-ink-muted m-0">{later.join(" · ")}</p>
          </article>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="mn-label m-0">{f.pictures}</h2>
        {items.length === 0 && <p className="small text-ink-muted m-0">{f.noPictures}</p>}
        {groups.map((g) => {
          const list = items.filter((x) => x.group === g.key);
          if (!list.length) return null;
          return (
            <div key={g.key} className="flex flex-col gap-2">
              <h3 className="small font-medium m-0">{g.label} · {list.length}</h3>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {list.map((x) => {
                  const l = links.get(x.path);
                  return (
                    <figure key={x.path} className="m-0 rounded-md border border-line overflow-hidden bg-surface flex flex-col">
                      <div className="bg-ground-deep" style={{ aspectRatio: "16 / 9" }}>
                        {l && (/\.(mp4|webm|mov)$/i.test(x.path) ? (
                          <video src={l.view} controls preload="metadata" className="w-full h-full object-cover" />
                        ) : /\.(mp3|wav|m4a|ogg)$/i.test(x.path) ? (
                          <div className="w-full h-full grid place-items-center px-2"><audio src={l.view} controls className="w-full" /></div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.view} alt={x.label} className="w-full h-full object-cover" loading="lazy" />
                        ))}
                      </div>
                      <figcaption className="flex items-center gap-2 px-2.5 py-2">
                        <span className="text-[12px] grow truncate" dir="auto">{x.label}</span>
                        {l && <a href={`${l.download}${encodeURIComponent(x.file)}`} className="text-[12px] underline shrink-0">{f.download}</a>}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
