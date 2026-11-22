"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChoiceField } from "@/components/choice-field";
import { findTerm, type TermKind } from "@/lib/film-terms";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { browserClient } from "@/lib/supabase/client";
import { approveStage, prepareUpload, saveOutputEdit } from "./actions";
import { ChangeBox } from "./editors";
import { RunLine, useCreativeRun, type RunCopy } from "./creative-run";
import { InlineText } from "./inline-doc";

// Stage 3, Look and characters: the six documents, the storyboard frames and their drawing.

type L = Dictionary["look"];
type Character = { name: string; role: string; age: string; look: string; personality: string; made_with: "ai" | "cast"; plan_a: string; plan_b: string; library_id: string | null; photos?: string[]; photo_consent?: boolean };
type Outfit = { character: string; scene: string; outfit: string; continuity: string };
type Location = { name: string; int_ext: "INT" | "EXT"; description: string; made_with: "ai" | "real"; options: string[]; library_id: string | null };
type Art = { set: string; dressing: string; props: string[] };
type Shot = { n: number; scene: string; int_ext: string; day_night: string; size: string; angle: string; movement: string; lens: string; action: string; dialogue: string; seconds: number; cast: string[]; props: string[]; set: string };
type Frame = { n: number; scene: string; size: string; angle: string; movement: string; lens: string; action: string; dialogue: string; seconds: number; cast: string[]; set: string; prompt: string };
export type LookPicture = { status: string; url: string | null; model: string; cost: number | null; error: string | null; version: number };
type Draw = { model: string; price: number; run: RunCopy; pictures: Record<string, LookPicture>; lang: "en" | "ar"; models: ModelOption[]; photoUrls?: Record<string, string>; library?: { id: string; name: string; age: string; look: string; voice: string }[] };
const key = (name: string) => name.trim().toLowerCase().slice(0, 200);
const termText = (kind: TermKind, v: string, lang: "en" | "ar") => findTerm(kind, v)?.[lang] ?? v;
export type FrameImage = { status: string; url: string | null; model: string; style: string; cost: number | null; error: string | null; version: number };

const fillIn = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const lines = (x: string) => x.split("\n").map((y) => y.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim()).filter(Boolean);
const list = (x: string) => x.split(/[,،\n]/).map((y) => y.trim()).filter(Boolean);
const iso = (x: string) => String.fromCharCode(0x2066) + x + String.fromCharCode(0x2069);
const usd = (n: number) => iso(`~$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`);

function useSave(projectId: string, n: number) {
  const router = useRouter();
  const [, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const save = (content: unknown) =>
    start(async () => {
      const r = await saveOutputEdit(projectId, n, content);
      setNote(r.error);
      router.refresh();
    });
  return { note, save };
}

function Table({ head, rows, minWidth }: { head: string[]; rows: React.ReactNode[][]; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse small" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} className="mn-label text-start py-2 pe-3 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line align-top">{r.map((x, j) => <td key={j} className="py-2 pe-3">{x}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Note({ note }: { note?: string }) {
  return note ? <p className="small m-0" role="alert">{note}</p> : null;
}

// ---------- Reference pictures (characters and locations) ----------

function usePictures(projectId: string, kind: "character" | "location", names: string[], d: Draw) {
  const r = useCreativeRun(projectId, d.run);
  // The picture model for this list: the project's last image model until another is picked.
  const [model, setModel] = useState(d.model);
  const price = d.models.find((m) => m.id === model)?.price ?? d.price;
  const pic = (name: string) => d.pictures[`${kind}:${key(name)}`];
  const missing = names.filter((n) => !pic(n)?.url && pic(n)?.status !== "generating");
  const draw = (ns: string[]) => r.run({ kind: "refs", refs: kind, names: ns, model });
  return { r, pic, missing, draw, model, setModel, price };
}

function PictureBar({ names, p, d, c, editable }: { names: string[]; p: ReturnType<typeof usePictures>; d: Draw; c: L; editable: boolean }) {
  if (!editable || !names.length) return null;
  const f = c.refs;
  return (
    <div className="rounded-lg border border-line p-4 flex flex-col gap-2">
      <span className="small text-ink-muted">{f.note}</span>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 min-w-[260px] grow">
          <span className="mn-label">{c.frames.model}</span>
          <select className="mn-select h-9" value={p.model} disabled={p.r.busy} onChange={(e) => p.setModel(e.target.value)}>
            {d.models.map((m) => (
              <option key={m.id} value={m.id}>{`${m.name} · ${fillIn(c.refs.per, { price: usd(m.price) })} · ${m.note}`}</option>
            ))}
          </select>
        </label>
        {p.r.busy ? (
          <button type="button" className="mn-btn mn-btn--secondary" onClick={p.r.stop}>{d.run.steps.stop}</button>
        ) : p.missing.length ? (
          <button type="button" className="mn-btn mn-btn--primary" onClick={() => p.draw(p.missing)}>
            {p.missing.length === 1 ? f.drawOnePic : fillIn(f.drawMissing, { n: p.missing.length })}
            <span className="mn-btn__cost">{usd(p.price * p.missing.length)}</span>
          </button>
        ) : (
          <button type="button" className="mn-btn mn-btn--secondary" onClick={() => p.draw(names)}>
            {f.drawAll}
            <span className="mn-btn__cost">{usd(p.price * names.length)}</span>
          </button>
        )}
      </div>
      {(p.r.busy || p.r.events.length > 0) && <RunLine events={p.r.events} busy={p.r.busy} c={d.run} startedAt={p.r.startedAt} />}
      {p.r.error && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="alert">{p.r.error}</p>}
    </div>
  );
}

function PictureBox({ name, p, d, c, editable }: { name: string; p: ReturnType<typeof usePictures>; d: Draw; c: L; editable: boolean }) {
  const img = p.pic(name);
  const busy = img?.status === "generating";
  return (
    <div className="relative -mx-4 -mt-4 mb-1 rounded-t-lg overflow-hidden bg-ground-deep border-b border-line grid place-items-center" style={{ aspectRatio: "16 / 9" }}>
      {img?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.url} alt={name} className="absolute inset-0 w-full h-full object-cover" />
      ) : busy ? (
        <div className="mn-skeleton absolute inset-0" />
      ) : null}
      {!img?.url && <span className="relative small text-ink-faint px-3 text-center">{busy ? c.refs.drawing : img?.status === "failed" ? c.refs.failed : c.refs.none}</span>}
      {editable && !busy && !p.r.busy && (
        <button type="button" className="absolute bottom-2 end-2 mn-btn mn-btn--secondary mn-btn--sm" onClick={() => p.draw([name])}>
          {img?.url ? c.refs.redraw : c.refs.drawOne}
          <span className="mn-btn__cost">{usd(p.price)}</span>
        </button>
      )}
    </div>
  );
}

// ---------- 13. Characters ----------

export function CharactersView({ projectId, content, editable, c, d }: { projectId: string; content: { characters: Character[] }; editable: boolean; c: L; d: Draw }) {
  const { save, note } = useSave(projectId, 13);
  const k = c.characters;
  const names = content.characters.map((x) => x.name).filter((x) => x?.trim());
  const p = usePictures(projectId, "character", names, d);
  const set = (i: number, patch: Partial<Character>) => save({ ...content, characters: content.characters.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4 max-w-[980px]">
      <PictureBar names={names} p={p} d={d} c={c} editable={editable} />
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {content.characters.map((x, i) => (
          <article key={i} className="rounded-lg border border-line p-4 flex flex-col gap-2.5 overflow-hidden">
            <PictureBox name={x.name} p={p} d={d} c={c} editable={editable} />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mn-chip mn-chip--ready"><ChoiceField kind="castMade" value={x.made_with} editable={editable} lang={d.lang} label={k.made} otherLabel={c.choice.other} useLabel={c.choice.use} onCommit={(v) => set(i, { made_with: v as Character["made_with"] })} /></span>
              {x.library_id && <span className="mn-chip mn-chip--approved">{k.library}</span>}
            </div>
            <div className="h3"><InlineText label={k.name} value={x.name} editable={editable} multiline={false} onCommit={(v) => set(i, { name: v })} /></div>
            <div className="small text-ink-muted"><InlineText label={k.role} value={x.role} editable={editable} multiline={false} onCommit={(v) => set(i, { role: v })} /></div>
            <Field label={k.age}><InlineText label={k.age} value={x.age} editable={editable} multiline={false} onCommit={(v) => set(i, { age: v })} /></Field>
            <Field label={k.look}><InlineText label={k.look} value={x.look} editable={editable} onCommit={(v) => set(i, { look: v })} /></Field>
            <Field label={k.personality}><InlineText label={k.personality} value={x.personality} editable={editable} onCommit={(v) => set(i, { personality: v })} /></Field>
            {editable && (d.library?.length ?? 0) > 0 && (
              <label className="flex flex-col gap-1">
                <span className="mn-label">{k.savedActor}</span>
                <select
                  className="mn-select h-8"
                  value={x.library_id ?? ""}
                  onChange={(e) => {
                    const a = d.library?.find((y) => y.id === e.target.value);
                    // A saved actor brings their face (the saved sheet guides the picture), look, age and voice.
                    set(i, a ? { library_id: a.id, made_with: "ai", look: a.look || x.look, age: a.age || x.age } : { library_id: null });
                  }}
                >
                  <option value="">{k.savedActorNone}</option>
                  {d.library?.map((a) => <option key={a.id} value={a.id}>{a.voice ? `${a.name} · ${a.voice}` : a.name}</option>)}
                </select>
              </label>
            )}
            {x.made_with !== "cast" && !x.library_id && <PersonPhotos projectId={projectId} x={x} urls={d.photoUrls ?? {}} editable={editable} c={c} onChange={(patch) => set(i, patch)} />}
            <Field label={k.planA}><InlineText label={k.planA} value={x.plan_a} editable={editable} onCommit={(v) => set(i, { plan_a: v })} /></Field>
            <Field label={k.planB}><InlineText label={k.planB} value={x.plan_b} editable={editable} onCommit={(v) => set(i, { plan_b: v })} /></Field>
          </article>
        ))}
      </div>
      <Note note={note} />
    </div>
  );
}

// Optional: photos of a real person, so the AI character looks like them. Written consent from
// that person is required before any photo is used; without it the photos are kept but ignored.
function PersonPhotos({ projectId, x, urls, editable, c, onChange }: { projectId: string; x: Character; urls: Record<string, string>; editable: boolean; c: L; onChange: (patch: Partial<Character>) => void }) {
  const k = c.characters;
  const photos = x.photos ?? [];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [local, setLocal] = useState<Record<string, string>>({});
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    const previews: Record<string, string> = {};
    for (const file of Array.from(files).slice(0, 3 - photos.length)) {
      const prep = await prepareUpload(projectId, "file", file.name, file.type, file.size);
      if (!prep.path || !prep.token) {
        setNote(prep.error);
        continue;
      }
      const { error } = await browserClient().storage.from("media").uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
      if (error) {
        setNote(error.message);
        continue;
      }
      added.push(prep.path);
      previews[prep.path] = URL.createObjectURL(file);
    }
    setBusy(false);
    setLocal((l) => ({ ...l, ...previews }));
    if (added.length) onChange({ photos: [...photos, ...added] });
  };
  if (!editable && !photos.length) return null;
  return (
    <div className="rounded-md border border-line p-3 flex flex-col gap-2">
      <h3 className="mn-label m-0">{k.likeTitle}</h3>
      <p className="text-[12px] text-ink-muted m-0">{k.likeNote}</p>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <figure key={p} className="m-0 relative w-[64px] h-[64px] rounded-md overflow-hidden bg-ground-deep border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {(local[p] ?? urls[p]) && <img src={local[p] ?? urls[p]} alt={x.name} className="absolute inset-0 w-full h-full object-cover" />}
              {editable && (
                <button type="button" className="absolute top-0.5 end-0.5 bg-surface/90 rounded-sm px-1 text-[11px]" aria-label={k.likeRemove} title={k.likeRemove} onClick={() => onChange({ photos: photos.filter((y) => y !== p) })}>
                  ✕
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
      {editable && (
        <>
          {photos.length < 3 && (
            <label className={`mn-btn mn-btn--secondary mn-btn--sm self-start ${busy ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
              {busy ? k.likeUploading : k.likeAdd}
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} />
            </label>
          )}
          {photos.length > 0 && (
            <label className="flex items-start gap-2 text-[12px]">
              <input type="checkbox" className="mt-0.5" checked={Boolean(x.photo_consent)} onChange={(e) => onChange({ photo_consent: e.target.checked })} />
              <span>{k.likeConsent}</span>
            </label>
          )}
          {photos.length > 0 && !x.photo_consent && <span className="text-[12px] text-ink-muted">{k.likeNeedsConsent}</span>}
        </>
      )}
      {note && <span className="text-[12px]" role="alert">{note}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mn-label m-0 mb-1">{label}</h3>
      <div className="small">{children}</div>
    </div>
  );
}

// ---------- 14. Wardrobe ----------

export function WardrobeView({ projectId, content, editable, c }: { projectId: string; content: { wardrobe: Outfit[] }; editable: boolean; c: L }) {
  const { save, note } = useSave(projectId, 14);
  const k = c.wardrobe;
  const set = (i: number, patch: Partial<Outfit>) => save({ ...content, wardrobe: content.wardrobe.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4 max-w-[980px]">
      <Table
        head={[k.character, k.scene, k.outfit, k.continuity]}
        rows={content.wardrobe.map((x, i) => [
          <InlineText key="c" label={k.character} value={x.character} editable={editable} multiline={false} onCommit={(v) => set(i, { character: v })} />,
          <InlineText key="s" label={k.scene} value={x.scene} editable={editable} multiline={false} onCommit={(v) => set(i, { scene: v })} />,
          <InlineText key="o" label={k.outfit} value={x.outfit} editable={editable} onCommit={(v) => set(i, { outfit: v })} />,
          <InlineText key="k" label={k.continuity} value={x.continuity} editable={editable} onCommit={(v) => set(i, { continuity: v })} />,
        ])}
      />
      <Note note={note} />
    </div>
  );
}

// ---------- 15. Locations ----------

export function LocationsView({ projectId, content, editable, c, d }: { projectId: string; content: { locations: Location[] }; editable: boolean; c: L; d: Draw }) {
  const { save, note } = useSave(projectId, 15);
  const k = c.locations;
  const names = content.locations.map((x) => x.name).filter((x) => x?.trim());
  const p = usePictures(projectId, "location", names, d);
  const set = (i: number, patch: Partial<Location>) => save({ ...content, locations: content.locations.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4 max-w-[980px]">
      <PictureBar names={names} p={p} d={d} c={c} editable={editable} />
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {content.locations.map((x, i) => (
          <article key={i} className="rounded-lg border border-line p-4 flex flex-col gap-2.5 overflow-hidden">
            <PictureBox name={x.name} p={p} d={d} c={c} editable={editable} />
            <div className="flex items-center gap-3 flex-wrap small">
              <ChoiceField kind="intExt" value={x.int_ext} editable={editable} lang={d.lang} label={k.intExt} otherLabel={c.choice.other} useLabel={c.choice.use} onCommit={(v) => set(i, { int_ext: v as Location["int_ext"] })} />
              <span className="mn-chip mn-chip--ready"><ChoiceField kind="placeMade" value={x.made_with} editable={editable} lang={d.lang} label={k.made} otherLabel={c.choice.other} useLabel={c.choice.use} onCommit={(v) => set(i, { made_with: v as Location["made_with"] })} /></span>
              {x.library_id && <span className="mn-chip mn-chip--approved">{k.library}</span>}
            </div>
            <div className="h3"><InlineText label={k.name} value={x.name} editable={editable} multiline={false} onCommit={(v) => set(i, { name: v })} /></div>
            <Field label={k.description}><InlineText label={k.description} value={x.description} editable={editable} onCommit={(v) => set(i, { description: v })} /></Field>
            <Field label={k.options}><InlineText label={k.options} value={x.options.join("\n")} editable={editable} onCommit={(v) => set(i, { options: lines(v) })} /></Field>
          </article>
        ))}
      </div>
      <Note note={note} />
    </div>
  );
}

// ---------- 16. Art direction ----------

export function ArtView({ projectId, content, editable, c }: { projectId: string; content: { art: Art[] }; editable: boolean; c: L }) {
  const { save, note } = useSave(projectId, 16);
  const k = c.art;
  const set = (i: number, patch: Partial<Art>) => save({ ...content, art: content.art.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4 max-w-[980px]">
      <Table
        head={[k.set, k.dressing, k.props]}
        rows={content.art.map((x, i) => [
          <InlineText key="s" label={k.set} value={x.set} editable={editable} multiline={false} onCommit={(v) => set(i, { set: v })} />,
          <InlineText key="d" label={k.dressing} value={x.dressing} editable={editable} onCommit={(v) => set(i, { dressing: v })} />,
          <InlineText key="p" label={k.props} value={x.props.join("\n")} editable={editable} onCommit={(v) => set(i, { props: lines(v) })} />,
        ])}
      />
      <Note note={note} />
    </div>
  );
}

// ---------- 18. Shot list ----------

export function ShotListView({ projectId, content, seconds, editable, c, lang }: { projectId: string; content: { shots: Shot[] }; seconds: number; editable: boolean; c: L; lang: "en" | "ar" }) {
  const { save, note } = useSave(projectId, 18);
  const k = c.shots;
  const set = (i: number, patch: Partial<Shot>) => save({ ...content, shots: content.shots.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const total = content.shots.reduce((n, x) => n + (Number(x.seconds) || 0), 0);
  const pick = (i: number, kind: TermKind, field: keyof Shot, label: string) => (
    <ChoiceField kind={kind} value={String(content.shots[i][field] ?? "")} editable={editable} lang={lang} label={label} otherLabel={c.choice.other} useLabel={c.choice.use} compact onCommit={(v) => set(i, { [field]: v } as Partial<Shot>)} />
  );
  const cell = (i: number, key: keyof Shot, label: string, multiline = false) => (
    <InlineText label={label} value={String(content.shots[i][key] ?? "")} editable={editable} multiline={multiline} onCommit={(v) => set(i, { [key]: v } as Partial<Shot>)} />
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="small m-0"><span className="data">{fillIn(k.total, { n: total, target: seconds })}</span></p>
      <Table
        minWidth={1500}
        head={[k.n, k.scene, k.intExt, k.dayNight, k.size, k.angle, k.movement, k.lens, k.action, k.dialogue, k.seconds, k.cast, k.props, k.set]}
        rows={content.shots.map((x, i) => [
          <span key="n" className="data">{x.n}</span>,
          cell(i, "scene", k.scene),
          pick(i, "intExt", "int_ext", k.intExt),
          pick(i, "dayNight", "day_night", k.dayNight),
          pick(i, "size", "size", k.size),
          pick(i, "angle", "angle", k.angle),
          pick(i, "movement", "movement", k.movement),
          pick(i, "lens", "lens", k.lens),
          <div key="a" className="min-w-[260px]">{cell(i, "action", k.action, true)}</div>,
          <div key="d" className="min-w-[200px]">{cell(i, "dialogue", k.dialogue, true)}</div>,
          <InlineText key="sec" label={k.seconds} value={String(x.seconds)} editable={editable} multiline={false} onCommit={(v) => set(i, { seconds: Math.max(0.5, Number(v) || x.seconds) })} />,
          <InlineText key="cast" label={k.cast} value={x.cast.join(", ")} editable={editable} onCommit={(v) => set(i, { cast: list(v) })} />,
          <InlineText key="props" label={k.props} value={x.props.join(", ")} editable={editable} onCommit={(v) => set(i, { props: list(v) })} />,
          <div key="set" className="min-w-[140px]">{cell(i, "set", k.set)}</div>,
        ])}
      />
      <Note note={note} />
    </div>
  );
}

// ---------- 17. Storyboard ----------

type ModelOption = { id: string; name: string; price: number; note: string };

export function StoryboardView({
  projectId,
  content,
  images,
  editable,
  c,
  run,
  models,
  model: initialModel,
  style: initialStyle,
  lang,
  waitingFor,
  defaultAspect = "16:9",
  staleFrames = [],
}: {
  projectId: string;
  content: { frames: Frame[] };
  images: Record<number, FrameImage>;
  editable: boolean;
  c: L;
  run: RunCopy;
  models: ModelOption[];
  model: string;
  style: "sketch" | "photo";
  lang: "en" | "ar";
  waitingFor?: string;
  defaultAspect?: string;
  staleFrames?: number[];
}) {
  const { save, note } = useSave(projectId, 17);
  const r = useCreativeRun(projectId, run);
  const f = c.frames;
  const [style, setStyle] = useState<"sketch" | "photo">(initialStyle);
  const [model, setModel] = useState(initialModel);
  // The frame shape comes from the brief's formats. A shape picked here is kept for this project.
  const [aspect, setAspect] = useState(defaultAspect);
  useEffect(() => {
    try {
      const a = localStorage.getItem(`menab-frame-aspect:${projectId}`);
      if (a && ["16:9", "9:16", "1:1"].includes(a)) setAspect(a);
    } catch {
      // No storage: keep the brief's shape.
    }
  }, [projectId]);
  const pickAspect = (a: string) => {
    setAspect(a);
    try {
      localStorage.setItem(`menab-frame-aspect:${projectId}`, a);
    } catch {
      // No storage.
    }
  };
  const price = models.find((m) => m.id === model)?.price ?? 0;
  const frames = content.frames ?? [];
  const drawn = frames.filter((x) => images[x.n]?.url);
  const missing = frames.filter((x) => !images[x.n]?.url && images[x.n]?.status !== "generating");
  const drawingNow = new Set(frames.filter((x) => images[x.n]?.status === "generating").map((x) => x.n));
  const draw = (ns: number[]) => r.run({ kind: "frames", frames: ns, style, model, aspect });
  const ratio = aspect === "9:16" ? "9 / 16" : aspect === "1:1" ? "1 / 1" : "16 / 9";
  const set = (i: number, patch: Partial<Frame>) => save({ ...content, frames: frames.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <div className="flex flex-col gap-5">
      {editable && (
        <div className="rounded-lg border border-line p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <span className="mn-label">{f.style}</span>
              <div className="mn-stagebar" role="group" aria-label={f.style}>
                {(["sketch", "photo"] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={style === s} className={`mn-stage ${style === s ? "mn-stage--current" : ""}`} onClick={() => setStyle(s)}>
                    {s === "sketch" ? f.sketch : f.photo}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5 min-w-[240px]">
              <span className="mn-label">{f.model}</span>
              <select className="mn-select h-9" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{`${m.name} · ${fillIn(f.per, { price: usd(m.price) })} · ${m.note}`}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="mn-label">{f.aspect}</span>
              <div className="mn-stagebar" role="group" aria-label={f.aspect}>
                {["16:9", "9:16", "1:1"].map((a) => (
                  <button key={a} type="button" lang="en" aria-pressed={aspect === a} className={`mn-stage ${aspect === a ? "mn-stage--current" : ""}`} onClick={() => pickAspect(a)}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="small text-ink-muted grow">{waitingFor ?? fillIn(f.count, { n: drawn.length, total: frames.length })}</span>
            {waitingFor ? null : r.busy ? (
              <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button>
            ) : (
              <>
                {missing.length > 0 && (
                  <button type="button" className="mn-btn mn-btn--primary" onClick={() => draw(missing.map((x) => x.n))}>
                    {missing.length === 1 ? f.drawOne : fillIn(f.drawMissing, { n: missing.length })}
                    <span className="mn-btn__cost">{usd(price * missing.length)}</span>
                  </button>
                )}
                {missing.length === 0 && frames.length > 0 && (
                  <button type="button" className="mn-btn mn-btn--secondary" onClick={() => draw(frames.map((x) => x.n))}>
                    {f.drawAll}
                    <span className="mn-btn__cost">{usd(price * frames.length)}</span>
                  </button>
                )}
              </>
            )}
          </div>
          {(r.busy || r.events.length > 0) && <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />}
          {r.error && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="alert">{r.error}</p>}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${aspect === "9:16" ? 200 : 280}px, 1fr))` }}>
        {frames.map((x, i) => {
          const img = images[x.n];
          const busy = drawingNow.has(x.n);
          return (
            <article key={x.n} className="rounded-lg border border-line overflow-hidden flex flex-col">
              <div className="relative bg-ground-deep border-b border-line grid place-items-center" style={{ aspectRatio: ratio }}>
                {img?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt={`${x.n}. ${x.action}`} className="absolute inset-0 w-full h-full object-cover" />
                ) : busy ? (
                  <div className="mn-skeleton absolute inset-0" />
                ) : null}
                {!img?.url && (
                  <span className="relative small text-ink-faint px-3 text-center">
                    {busy ? f.drawing : img?.status === "failed" ? f.failed : f.notDrawn}
                  </span>
                )}
                {busy && img?.url && <span className="absolute top-2 end-2 mn-chip mn-chip--generating"><span className="mn-chip__icon" aria-hidden="true" />{f.drawing}</span>}
                {!busy && img?.url && staleFrames.includes(x.n) && <span className="absolute top-2 end-2 mn-chip bg-surface" title={f.beforeChangeNote}>{f.beforeChange}</span>}
              </div>
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="mn-label" lang="en">{String(x.n).padStart(2, "0")}</span>
                  <span className="text-[12px] text-ink-muted grow truncate" dir="auto">{[termText("size", x.size, lang), termText("angle", x.angle, lang), termText("movement", x.movement, lang), x.lens].filter(Boolean).join(" · ")}</span>
                  <span className="data text-[12px]">{x.seconds}s</span>
                </div>
                <div className="small" dir="auto">{x.action}</div>
                {x.dialogue && <div className="small text-ink-muted" dir="auto">{x.dialogue}</div>}
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-ink-muted">{f.prompt}</summary>
                  <div className="mt-1.5" dir="ltr" lang="en">
                    <InlineText label={f.prompt} value={x.prompt} editable={editable} onCommit={(v) => set(i, { prompt: v })} />
                  </div>
                </details>
                {editable && !waitingFor && img?.url && !busy && !r.busy && (
                  <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" onClick={() => draw([x.n])}>
                    {f.redraw}
                    <span className="mn-btn__cost">{usd(price)}</span>
                  </button>
                )}
                {editable && !waitingFor && !img?.url && !busy && !r.busy && (
                  <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" onClick={() => draw([x.n])}>
                    {f.drawOne}
                    <span className="mn-btn__cost">{usd(price)}</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <Note note={note} />
    </div>
  );
}

// ---------- Writing the stage ----------

// Stage 3's footer: writes the six documents, then approves the stage. One footer for both, so
// the live steps stay on screen from the first document to the last.
export function LookFooter({
  projectId,
  message,
  write,
  approve,
  draw,
  run,
}: {
  projectId: string;
  message: string;
  write: { label: string; cost: string } | null;
  approve: string | null;
  draw?: { frames: number[]; model: string; style: "sketch" | "photo"; aspect: string; label: string; cost: string } | null;
  run: RunCopy;
}) {
  const r = useCreativeRun(projectId, run);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const doApprove = () =>
    start(async () => {
      const res = await approveStage(projectId, 3);
      setError(res.error);
      if (!res.error) router.push(`/p/${projectId}`);
      router.refresh();
    });
  return (
    <footer className="shrink-0 sticky bottom-0 bg-surface border-t border-line px-5 py-3 flex flex-wrap gap-3 items-center z-10">
      <div className="grow min-w-0 flex flex-col gap-1" role="status">
        {r.busy || r.events.length ? <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} /> : <span className="small text-ink-muted">{message}</span>}
        {(r.error || error) && <span className="small" role="alert">{r.error ?? error}</span>}
      </div>
      {r.busy ? (
        <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button>
      ) : draw ? (
        <button
          type="button"
          className="mn-btn mn-btn--primary"
          onClick={() => {
            let aspect = draw.aspect;
            try {
              aspect = localStorage.getItem(`menab-frame-aspect:${projectId}`) || draw.aspect;
            } catch {
              // No storage: the brief's shape.
            }
            r.run({ kind: "frames", frames: draw.frames, style: draw.style, model: draw.model, aspect });
          }}
        >
          {draw.label}
          <span className="mn-btn__cost">{draw.cost}</span>
        </button>
      ) : approve ? (
        <button type="button" className="mn-btn mn-btn--primary" disabled={pending} onClick={doApprove}>{approve}</button>
      ) : write ? (
        <button type="button" className="mn-btn mn-btn--primary" onClick={() => r.run({ kind: "look", action: { kind: "write" } })}>
          {write.label}
          <span className="mn-btn__cost">{write.cost}</span>
        </button>
      ) : null}
    </footer>
  );
}

// A stage 3 document that failed or was never written: one press writes its pair again.
export function LookTryAgain({ projectId, n, failed, cost, run, c }: { projectId: string; n: number; failed: boolean; cost: string; run: RunCopy; c: { failed: string; missing: string; tryAgain: string; write: string } }) {
  const r = useCreativeRun(projectId, run);
  return (
    <div className="flex flex-col gap-3 items-start">
      <p className="body text-ink-muted m-0">{failed ? c.failed : c.missing}</p>
      <div className="flex flex-wrap items-center gap-3">
        {r.busy ? (
          <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button>
        ) : (
          <button type="button" className="mn-btn mn-btn--primary" onClick={() => r.run({ kind: "look", action: { kind: "redo", n } })}>
            {failed ? c.tryAgain : c.write}
            <span className="mn-btn__cost">{cost}</span>
          </button>
        )}
        <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />
      </div>
      {r.error && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="alert">{r.error}</p>}
    </div>
  );
}

// Change the open stage 3 document with an instruction, or write it again.
export function LookAssistant({
  projectId,
  n,
  copy,
  cost,
  mic,
  run,
  rewriteLabel,
}: {
  projectId: string;
  n: number;
  copy: { label: string; placeholder: string; apply: string; working: string };
  cost: string;
  mic: { start: string; stop: string; working: string; blocked: string };
  run: RunCopy;
  rewriteLabel: string;
}) {
  const r = useCreativeRun(projectId, run);
  return (
    <div className="flex flex-col gap-2">
      <ChangeBox projectId={projectId} copy={copy} cost={cost} mic={mic} disabled={r.busy} onApply={(text) => r.run({ kind: "look", action: { kind: "revise", n, instruction: text } })} />
      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm justify-between w-full" disabled={r.busy} onClick={() => r.run({ kind: "look", action: { kind: "redo", n } })}>
        <span>{rewriteLabel}</span>
        <span className="mn-btn__cost">{cost}</span>
      </button>
      <div className="flex items-center gap-3">
        <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />
        {r.busy && <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={r.stop}>{run.steps.stop}</button>}
      </div>
    </div>
  );
}
