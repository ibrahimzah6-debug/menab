"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { browserClient } from "@/lib/supabase/client";
import { approveClip, prepareUpload, saveActorToLibrary, saveReferenceLock } from "./actions";
import { RunLine, useCreativeRun, type RunCopy } from "./creative-run";
import { InlineText } from "./inline-doc";

// Stage 5, Generate, in working order: the reference lock (34), voice (37), keyframes (35),
// video shots (36), then music and review (38). Every button shows its price before it runs.

type G = Dictionary["generate"];
export type GenAsset = { id: string; status: string; approved: boolean; model: string; prompt: string; url: string | null; version: number; seconds: number | null; cost: number | null; error: string | null };
type Product = { name: string; description: string; photos: { path: string; url: string | null }[] };
export type GenData = {
  projectId: string;
  editable: boolean;
  lang: "en" | "ar";
  assets: Record<string, GenAsset>;
  characters: { name: string; role?: string; made_with?: string; picture: string | null; library: boolean; voice: string; style: string; suggested: boolean; hasLines: boolean; speaks: boolean }[];
  narrator: { voice: string; style: string; suggested: boolean };
  aspect: string;
  products: Product[];
  talkingModel: string;
  locations: { name: string; picture: string | null }[];
  outfits: { key: string; character: string; outfit: string }[];
  shots: { n: number; action: string; size: string; movement: string; seconds: number; dialogue: string; frame: string | null; speaks: boolean; speaker: string; clipPrompt: string; talkPrompt: string }[];
  lines: { key: string; text: string }[];
  dialogue: { key: string; n: number; speaker: string; text: string }[];
  lock: { locked?: boolean; consent?: boolean; narrator?: string; narratorStyle?: string; voices?: Record<string, string>; styles?: Record<string, string>; speaks?: Record<string, boolean>; aspect?: string; imageModel?: string; products?: unknown[] };
  imageModels: { id: string; name: string; price: number; note: string }[];
  voices: { id: string; name: string; gender: "m" | "f"; tone: string }[];
  clipModels: { id: string; name: string; perSecond: number; min: number; max: number; fixedSeconds?: number; talking?: boolean; note: string }[];
  prices: { image: number; voiceLine: number[]; dialogueLine: number[]; voiceTry: number; music: number };
};

const iso = (x: string) => String.fromCharCode(0x2066) + x + String.fromCharCode(0x2069);
const usd = (n: number) => iso(`~$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`);
const fillIn = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const key = (s: string) => s.trim().toLowerCase().slice(0, 200);
const ratioOf = (a: string) => (a === "9:16" ? "9 / 16" : a === "1:1" ? "1 / 1" : "16 / 9");

function useGen(d: GenData, run: RunCopy) {
  const r = useCreativeRun(d.projectId, run);
  const go = (body: Record<string, unknown>) => r.run({ kind: "gen", body });
  return { r, go };
}

function useLockSave(projectId: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const save = (patch: Parameters<typeof saveReferenceLock>[1]) =>
    start(async () => {
      const res = await saveReferenceLock(projectId, patch);
      setNote(res.error);
      router.refresh();
    });
  return { save, pending, note, setNote, start, router };
}

function Bar({ children, r, run }: { children: React.ReactNode; r: ReturnType<typeof useCreativeRun>; run: RunCopy }) {
  return (
    <div className="rounded-lg border border-line p-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">{r.busy ? <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button> : children}</div>
      {(r.busy || r.events.length > 0) && <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />}
      {r.error && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="alert">{r.error}</p>}
    </div>
  );
}

// The model that makes the actor sheets, outfit pictures and keyframes. Changing it never
// remakes anything; it applies to the next pictures made.
function PictureModel({ d, g }: { d: GenData; g: G }) {
  const { save, pending, note } = useLockSave(d.projectId);
  const value = d.lock.imageModel ?? d.imageModels[0]?.id;
  return (
    <label className="flex flex-col gap-1.5 min-w-[280px]">
      <span className="mn-label">{g.pictureModel}</span>
      <select className="mn-select h-9" value={value} disabled={!d.editable || pending} onChange={(e) => save({ imageModel: e.target.value })}>
        {d.imageModels.map((m) => <option key={m.id} value={m.id}>{`${m.name} · ${m.note} · ~$${m.price.toFixed(2)}`}</option>)}
      </select>
      {note && <span className="small" role="alert">{note}</span>}
    </label>
  );
}

function Media({ a, kind, alt, g, ratio = "16 / 9" }: { a?: GenAsset; kind: "image" | "video" | "audio"; alt: string; g: G; ratio?: string }) {
  const busy = a?.status === "generating";
  if (kind === "audio") {
    return a?.url ? <audio controls src={a.url} className="w-full h-9" /> : <span className="text-[12px] text-ink-faint">{busy ? g.making : a?.status === "failed" ? g.failed : g.notMade}</span>;
  }
  return (
    <div className="relative bg-ground-deep grid place-items-center overflow-hidden" style={{ aspectRatio: ratio }}>
      {a?.url ? (
        kind === "video" ? (
          <video src={a.url} controls playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.url} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
        )
      ) : busy ? (
        <div className="mn-skeleton absolute inset-0" />
      ) : null}
      {!a?.url && <span className="relative small text-ink-faint px-3 text-center">{busy ? g.making : a?.status === "failed" ? g.failed : g.notMade}</span>}
    </div>
  );
}

// A voice for one character (or the narrator): the voice list grouped by women and men, the
// "Suggested" mark, how it sounds, and a button that plays the first line inside the app.
// Voices can change after the lock: they never change a picture.
function VoicePick({
  d,
  g,
  who,
  voice,
  style,
  suggested,
  onSave,
  pending,
  hear,
  busy,
}: {
  d: GenData;
  g: G;
  who: string | null;
  voice: string;
  style: string;
  suggested: boolean;
  onSave: (v: { voice?: string; style?: string }) => void;
  pending: boolean;
  hear: () => void;
  busy: boolean;
}) {
  const sample = d.assets[`voicetry:try-${who ? key(who) : "narrator"}`];
  const can = d.editable && !pending;
  const women = d.voices.filter((v) => v.gender === "f");
  const men = d.voices.filter((v) => v.gender === "m");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select className="mn-select h-8 grow min-w-0" aria-label={g.voice} value={voice} disabled={!can} onChange={(e) => onSave({ voice: e.target.value })}>
          <optgroup label={g.women}>{women.map((v) => <option key={v.id} value={v.id}>{`${v.name} · ${v.tone}`}</option>)}</optgroup>
          <optgroup label={g.men}>{men.map((v) => <option key={v.id} value={v.id}>{`${v.name} · ${v.tone}`}</option>)}</optgroup>
        </select>
        {suggested && <span className="mn-chip shrink-0">{g.suggested}</span>}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-muted">{g.voiceStyle}</span>
        <input
          key={style}
          className="mn-input h-8 text-[13px]"
          dir="auto"
          defaultValue={style}
          disabled={!can}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== style) onSave({ style: v });
          }}
        />
      </label>
      <div className="flex items-center gap-2">
        {d.editable && !busy && sample?.status !== "generating" && (
          <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm shrink-0" onClick={hear}>
            {g.hear}<span className="mn-btn__cost">{usd(d.prices.voiceTry)}</span>
          </button>
        )}
        {(sample?.url || sample?.status === "generating") && <div className="grow min-w-0"><Media a={sample} kind="audio" alt={g.hear} g={g} /></div>}
      </div>
    </div>
  );
}

// The products that must look the same in every shot: name, what it looks like, and photos of
// the real thing. Photos go to the project's own storage first, then into the lock.
function Products({ d, g, can }: { d: GenData; g: G; can: boolean }) {
  const { save, pending, note, setNote } = useLockSave(d.projectId);
  const [list, setList] = useState<Product[]>(d.products);
  const [uploading, setUploading] = useState<number | null>(null);
  const store = (next: Product[]) => {
    setList(next);
    save({ products: next.map((p) => ({ name: p.name, description: p.description, photos: p.photos.map((x) => x.path) })) });
  };
  const upload = async (i: number, files: FileList | null) => {
    if (!files?.length) return;
    setUploading(i);
    const added: { path: string; url: string | null }[] = [];
    for (const file of Array.from(files).slice(0, 4 - list[i].photos.length)) {
      const prep = await prepareUpload(d.projectId, "file", file.name, file.type, file.size);
      if (!prep.path || !prep.token) {
        setNote(prep.error);
        continue;
      }
      const { error } = await browserClient().storage.from("media").uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
      if (error) {
        setNote(error.message);
        continue;
      }
      added.push({ path: prep.path, url: URL.createObjectURL(file) });
    }
    setUploading(null);
    if (added.length) store(list.map((p, j) => (j === i ? { ...p, photos: [...p.photos, ...added] } : p)));
  };
  return (
    <section className="flex flex-col gap-3">
      <h3 className="mn-label m-0">{g.productsTitle}</h3>
      <p className="small text-ink-muted m-0">{g.productsNote}</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {list.map((p, i) => (
          <article key={i} className="rounded-lg border border-line p-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-ink-muted">{g.productName}</span>
              <input
                className="mn-input h-8"
                dir="auto"
                defaultValue={p.name}
                disabled={!can || pending}
                onBlur={(e) => e.target.value.trim() !== p.name && store(list.map((x, j) => (j === i ? { ...x, name: e.target.value.trim() } : x)))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-ink-muted">{g.productDesc}</span>
              <textarea
                className="mn-input min-h-[64px] py-1.5"
                dir="auto"
                defaultValue={p.description}
                disabled={!can || pending}
                onBlur={(e) => e.target.value.trim() !== p.description && store(list.map((x, j) => (j === i ? { ...x, description: e.target.value.trim() } : x)))}
              />
            </label>
            {p.photos.length === 0 ? (
              <p className="text-[12px] text-ink-faint m-0">{g.noPhotos}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {p.photos.map((ph) => (
                  <figure key={ph.path} className="m-0 relative w-[76px] h-[76px] rounded-md overflow-hidden bg-ground-deep border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {ph.url && <img src={ph.url} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />}
                    {can && (
                      <button
                        type="button"
                        className="absolute top-0.5 end-0.5 bg-surface/90 rounded-sm px-1 text-[11px]"
                        aria-label={g.removePhoto}
                        title={g.removePhoto}
                        disabled={pending}
                        onClick={() => store(list.map((x, j) => (j === i ? { ...x, photos: x.photos.filter((y) => y.path !== ph.path) } : x)))}
                      >
                        ✕
                      </button>
                    )}
                  </figure>
                ))}
              </div>
            )}
            {can && (
              <div className="flex items-center gap-2">
                {p.photos.length < 4 && (
                  <label className={`mn-btn mn-btn--secondary mn-btn--sm ${uploading !== null || pending ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
                    {uploading === i ? g.making : g.addPhoto}
                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(e) => upload(i, e.target.files)} />
                  </label>
                )}
                <span className="grow" />
                <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => store(list.filter((_, j) => j !== i))}>{g.removeProduct}</button>
              </div>
            )}
          </article>
        ))}
      </div>
      {can && list.length < 6 && (
        <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" disabled={pending} onClick={() => setList([...list, { name: "", description: "", photos: [] }])}>{g.addProduct}</button>
      )}
      {note && <p className="small m-0" role="alert">{note}</p>}
    </section>
  );
}

// ---------- 34. Reference lock ----------

export function ReferenceLockView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const { save, pending, note, setNote, start, router } = useLockSave(d.projectId);
  const locked = Boolean(d.lock.locked);
  const can = d.editable && !locked;
  const ai = d.characters.filter((c) => c.made_with !== "cast");
  const missingSheets = ai.filter((c) => !d.assets[`sheet:${key(c.name)}`]?.url && d.assets[`sheet:${key(c.name)}`]?.status !== "generating");
  const missingOutfits = d.outfits.filter((o) => !d.assets[`outfit:${o.key}`]?.url && d.assets[`outfit:${o.key}`]?.status !== "generating");
  const fromBrief = !d.lock.aspect;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <PictureModel d={d} g={g} />
        <div className="flex flex-col gap-1.5">
          <span className="mn-label">{g.shape}</span>
          <div className="flex items-center gap-2">
            <div className="mn-stagebar" role="group" aria-label={g.shape}>
              {["16:9", "9:16", "1:1"].map((a) => (
                <button key={a} type="button" lang="en" disabled={!can || pending} aria-pressed={d.aspect === a} className={`mn-stage ${d.aspect === a ? "mn-stage--current" : ""}`} onClick={() => save({ aspect: a })}>{a}</button>
              ))}
            </div>
            {fromBrief && <span className="text-[12px] text-ink-muted">{g.fromBrief}</span>}
          </div>
        </div>
        <span className="grow" />
        {locked && (
          <div className="flex items-center gap-3">
            <span className="mn-chip mn-chip--approved">{g.locked}</span>
            {d.editable && <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => save({ locked: false })}>{g.unlock}</button>}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="mn-label m-0">{g.actorsTitle}</h3>
        <p className="small text-ink-muted m-0">{g.actorsNote}</p>
        {can && (missingSheets.length > 0 || missingOutfits.length > 0 || r.busy || r.events.length > 0) && (
          <Bar r={r} run={run}>
            {missingSheets.length > 0 && (
              <button type="button" className="mn-btn mn-btn--secondary" onClick={() => go({ kind: "sheet", names: missingSheets.map((c) => c.name) })}>
                {fillIn(g.makeSheets, { n: missingSheets.length })}<span className="mn-btn__cost">{usd(d.prices.image * missingSheets.length)}</span>
              </button>
            )}
            {missingOutfits.length > 0 && (
              <button type="button" className="mn-btn mn-btn--secondary" onClick={() => go({ kind: "outfit", keys: missingOutfits.map((o) => o.key) })}>
                {fillIn(g.makeOutfits, { n: missingOutfits.length })}<span className="mn-btn__cost">{usd(d.prices.image * missingOutfits.length)}</span>
              </button>
            )}
          </Bar>
        )}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {d.characters.map((c) => {
            const k = key(c.name);
            const sheet = d.assets[`sheet:${k}`];
            const isAi = c.made_with !== "cast";
            return (
              <article key={c.name} className="rounded-lg border border-line overflow-hidden flex flex-col">
                <div className="grid grid-cols-[1fr_2fr]">
                  <div className="relative bg-ground-deep" style={{ aspectRatio: "1 / 1" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.picture && <img src={c.picture} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <span className="absolute bottom-1 start-1 text-[10px] bg-surface/90 px-1.5 rounded-sm">{g.stagePicture}</span>
                  </div>
                  {isAi ? <Media a={sheet} kind="image" alt={`${g.sheet}: ${c.name}`} g={g} ratio="16 / 9" /> : <div className="bg-ground-deep" />}
                </div>
                <div className="p-3 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium grow" dir="auto">{c.name}</span>
                    {can && isAi && !r.busy && sheet?.status !== "generating" && (
                      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => go({ kind: "sheet", names: [c.name] })}>
                        {sheet?.url ? g.remake : g.makeSheet}<span className="mn-btn__cost">{usd(d.prices.image)}</span>
                      </button>
                    )}
                  </div>
                  {c.hasLines && (
                    <label className="flex items-start gap-2 small">
                      <input type="checkbox" className="mt-1" checked={c.speaks} disabled={!d.editable || pending} onChange={(e) => save({ speaks: { [k]: e.target.checked } })} />
                      <span className="flex flex-col">
                        <span>{g.speaks}</span>
                        <span className="text-[12px] text-ink-muted">{g.speaksNote}</span>
                      </span>
                    </label>
                  )}
                  <VoicePick
                    d={d}
                    g={g}
                    who={c.name}
                    voice={c.voice}
                    style={c.style}
                    suggested={c.suggested}
                    pending={pending}
                    busy={r.busy}
                    hear={() => go({ kind: "voicetry", who: c.name })}
                    onSave={(v) => save(v.voice !== undefined ? { voices: { [k]: v.voice } } : { styles: { [k]: v.style ?? "" } })}
                  />
                  {d.editable && (sheet?.url || c.picture) && (
                    <button
                      type="button"
                      className="mn-btn mn-btn--ghost mn-btn--sm self-start"
                      disabled={pending}
                      onClick={() => start(async () => { const res = await saveActorToLibrary(d.projectId, c.name); setNote(res.error ?? `${c.name}: ${g.savedLibrary}`); router.refresh(); })}
                    >
                      {g.saveLibrary}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Products d={d} g={g} can={can} />

      {d.outfits.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="mn-label m-0">{g.outfits}</h3>
          <p className="small text-ink-muted m-0">{g.outfitsNote}</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {d.outfits.map((o) => {
              const a = d.assets[`outfit:${o.key}`];
              return (
                <figure key={o.key} className="m-0 rounded-md border border-line overflow-hidden">
                  <Media a={a} kind="image" alt={o.outfit} g={g} ratio="9 / 16" />
                  <figcaption className="p-2 text-[12px] flex flex-col gap-1.5">
                    <span dir="auto"><strong>{o.character}</strong>: {o.outfit}</span>
                    {can && !r.busy && a?.status !== "generating" && (
                      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" onClick={() => go({ kind: "outfit", keys: [o.key] })}>
                        {a?.url ? g.remake : g.makeOne}<span className="mn-btn__cost">{usd(d.prices.image)}</span>
                      </button>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="mn-label m-0">{g.locations}</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {d.locations.map((l) => (
            <figure key={l.name} className="m-0 rounded-md border border-line overflow-hidden">
              <div className="relative bg-ground-deep" style={{ aspectRatio: "16 / 9" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.picture ? <img src={l.picture} alt={l.name} className="absolute inset-0 w-full h-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-[12px] text-ink-faint">{g.noPicture}</span>}
              </div>
              <figcaption className="p-2 text-[12px]" dir="auto">{l.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {d.lines.length > 0 && (
        <section className="flex flex-col gap-3 max-w-[420px]">
          <h3 className="mn-label m-0">{g.narrator}</h3>
          <VoicePick
            d={d}
            g={g}
            who={null}
            voice={d.narrator.voice}
            style={d.narrator.style}
            suggested={d.narrator.suggested}
            pending={pending}
            busy={r.busy}
            hear={() => go({ kind: "voicetry", who: null })}
            onSave={(v) => save(v.voice !== undefined ? { narrator: v.voice } : { narratorStyle: v.style ?? "" })}
          />
        </section>
      )}

      {d.editable && !locked && (
        <div className="rounded-lg border border-line p-4 flex flex-wrap items-center gap-3">
          {d.characters.some((c) => c.library) && (
            <label className="flex items-start gap-2 small grow">
              <input type="checkbox" checked={Boolean(d.lock.consent)} disabled={pending} onChange={(e) => save({ consent: e.target.checked })} className="mt-1" />
              <span>{g.consent}</span>
            </label>
          )}
          <span className="grow" />
          <button type="button" className="mn-btn mn-btn--primary" disabled={pending || r.busy} onClick={() => save({ locked: true })}>{g.lock}</button>
        </div>
      )}
      {note && <p className="small m-0" role="alert">{note}</p>}
    </div>
  );
}

// ---------- 37. Voice ----------

export function SoundView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const missing = d.lines.filter((l) => !d.assets[`voice:${l.key}`]?.url && d.assets[`voice:${l.key}`]?.status !== "generating");
  const missingDialogue = d.dialogue.filter((l) => !d.assets[`voice:${l.key}`]?.url && d.assets[`voice:${l.key}`]?.status !== "generating");
  const dlPrice = (i: number) => d.prices.dialogueLine[i] ?? 0.002;
  const linePrice = (i: number) => d.prices.voiceLine[i] ?? 0.002;
  const voiceName = (id: string) => d.voices.find((v) => v.id === id)?.name ?? id;
  const speakerVoice = (name: string) => d.characters.find((c) => key(c.name) === key(name))?.voice ?? "";
  return (
    <div className="flex flex-col gap-5">
      {!d.lock.locked && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2">{g.lockFirst}</p>}
      <p className="small text-ink-muted m-0">{g.voiceNote}</p>
      {d.editable && d.lock.locked && (missing.length > 0 || missingDialogue.length > 0 || r.busy || r.events.length > 0) && (
        <Bar r={r} run={run}>
          {missing.length > 0 && (
            <button type="button" className="mn-btn mn-btn--primary" onClick={() => go({ kind: "voice", keys: missing.map((l) => l.key) })}>
              {fillIn(g.makeVoice, { n: missing.length })}<span className="mn-btn__cost">{usd(missing.reduce((n, l) => n + linePrice(d.lines.indexOf(l)), 0))}</span>
            </button>
          )}
          {missingDialogue.length > 0 && (
            <button type="button" className="mn-btn mn-btn--secondary" onClick={() => go({ kind: "voice", keys: missingDialogue.map((l) => l.key) })}>
              {fillIn(g.makeDialogue, { n: missingDialogue.length })}<span className="mn-btn__cost">{usd(missingDialogue.reduce((n, l) => n + dlPrice(d.dialogue.indexOf(l)), 0))}</span>
            </button>
          )}
        </Bar>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="mn-label m-0">{g.narrator} · <span lang="en">{voiceName(d.narrator.voice)}</span></h3>
        {d.lines.length === 0 && <p className="small text-ink-muted m-0">{g.noVoice}</p>}
        {d.lines.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col border border-line rounded-lg">
            {d.lines.map((l, i) => {
              const a = d.assets[`voice:${l.key}`];
              return (
                <li key={l.key} className={`grid gap-3 items-center px-4 py-3 ${i ? "border-t border-line" : ""}`} style={{ gridTemplateColumns: "40px 1fr 260px auto" }}>
                  <span className="mn-label" lang="en">{String(i + 1).padStart(2, "0")}</span>
                  <span className="small" dir="auto">{l.text}</span>
                  <Media a={a} kind="audio" alt={l.text} g={g} />
                  {d.editable && d.lock.locked && !r.busy && a?.status !== "generating" ? (
                    <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => go({ kind: "voice", keys: [l.key] })}>
                      {a?.url ? g.remake : g.makeOne}<span className="mn-btn__cost">{usd(linePrice(i))}</span>
                    </button>
                  ) : <span />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {d.dialogue.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="mn-label m-0">{g.dialogueTitle}</h3>
          <p className="small text-ink-muted m-0">{g.dialogueNote}</p>
          <ul className="m-0 p-0 list-none flex flex-col border border-line rounded-lg">
            {d.dialogue.map((l, i) => {
              const a = d.assets[`voice:${l.key}`];
              return (
                <li key={l.key} className={`grid gap-3 items-center px-4 py-3 ${i ? "border-t border-line" : ""}`} style={{ gridTemplateColumns: "150px 1fr 260px auto" }}>
                  <span className="text-[12px] text-ink-muted flex flex-col" dir="auto">
                    <span>{fillIn(g.dialogue, { n: l.n, name: l.speaker })}</span>
                    {speakerVoice(l.speaker) && <span lang="en">{voiceName(speakerVoice(l.speaker))}</span>}
                  </span>
                  <span className="small" dir="auto">{l.text}</span>
                  <Media a={a} kind="audio" alt={l.text} g={g} />
                  {d.editable && d.lock.locked && !r.busy && a?.status !== "generating" ? (
                    <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => go({ kind: "voice", keys: [l.key] })}>
                      {a?.url ? g.remake : g.makeOne}<span className="mn-btn__cost">{usd(dlPrice(i))}</span>
                    </button>
                  ) : <span />}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------- 35. Keyframes ----------

export function KeyframesView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const can = d.editable && Boolean(d.lock.locked);
  const ratio = ratioOf(d.aspect);
  const missing = d.shots.filter((s) => !d.assets[`keyframe:${s.n}`]?.url && d.assets[`keyframe:${s.n}`]?.status !== "generating");
  return (
    <div className="flex flex-col gap-4">
      {!d.lock.locked && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2">{g.lockFirst}</p>}
      <p className="small text-ink-muted m-0">{g.keyframesNote}</p>
      {d.lock.locked && <PictureModel d={d} g={g} />}
      {can && (missing.length > 0 || r.busy || r.events.length > 0) && (
        <Bar r={r} run={run}>
          {missing.length > 0 && (
            <button type="button" className="mn-btn mn-btn--primary" onClick={() => go({ kind: "keyframe", shots: missing.map((s) => s.n) })}>
              {fillIn(g.makeKeyframes, { n: missing.length })}<span className="mn-btn__cost">{usd(d.prices.image * missing.length)}</span>
            </button>
          )}
        </Bar>
      )}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.aspect === "9:16" ? 180 : 260}px, 1fr))` }}>
        {d.shots.map((s) => {
          const a = d.assets[`keyframe:${s.n}`];
          return (
            <article key={s.n} className="rounded-lg border border-line overflow-hidden flex flex-col">
              <Media a={a} kind="image" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} />
              <div className="p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="mn-label" lang="en">{String(s.n).padStart(2, "0")}</span>
                  <span className="text-[12px] text-ink-muted grow truncate" dir="auto">{s.size}</span>
                </div>
                <span className="small" dir="auto">{s.action}</span>
                {can && !r.busy && a?.status !== "generating" && (
                  <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" onClick={() => go({ kind: "keyframe", shots: [s.n] })}>
                    {a?.url ? g.remake : g.makeOne}<span className="mn-btn__cost">{usd(d.prices.image)}</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 36. Video shots ----------

export function ClipsView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const [model, setModel] = useState(d.clipModels.find((x) => !x.talking)?.id ?? "kling-3-0");
  const [auto, setAuto] = useState(true);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const m = d.clipModels.find((x) => x.id === model) ?? d.clipModels[0];
  const talkM = d.clipModels.find((x) => x.talking && x.name === d.talkingModel);
  const hasLine = (n: number) => Boolean(d.assets[`voice:dl-${n}`]?.url);
  // The model a shot is really made with: a talking avatar when its character speaks on camera
  // and the line is ready, unless that is turned off or a talking model was picked by hand.
  const modelFor = (s: GenData["shots"][number]) => (!m.talking && auto && s.speaks && hasLine(s.n) && talkM ? talkM : m);
  const secs = (x: GenData["clipModels"][number], s: number) => x.fixedSeconds ?? Math.max(x.min, Math.min(x.max, Math.round(s || 5)));
  const price = (s: GenData["shots"][number]) => { const x = modelFor(s); return secs(x, s.seconds) * x.perSecond; };
  const promptFor = (s: GenData["shots"][number]) => prompts[String(s.n)] ?? (modelFor(s).talking ? s.talkPrompt : s.clipPrompt);
  const ready = d.shots.filter((s) => d.assets[`keyframe:${s.n}`]?.url && (!m.talking || hasLine(s.n)));
  const missing = ready.filter((s) => !d.assets[`clip:${s.n}`]?.url && d.assets[`clip:${s.n}`]?.status !== "generating");
  const ratio = ratioOf(d.aspect);
  const anySpeaks = d.shots.some((s) => s.speaks);
  return (
    <div className="flex flex-col gap-4">
      {d.editable && (
        <Bar r={r} run={run}>
          <label className="flex items-center gap-2 small">
            <span className="mn-label">{g.clipModel}</span>
            <select className="mn-select h-9 max-w-[420px]" value={model} onChange={(e) => setModel(e.target.value)}>
              <optgroup label={g.videoGroup}>
                {d.clipModels.filter((x) => !x.talking).map((x) => <option key={x.id} value={x.id}>{`${x.name} · ${usd(x.perSecond)}/s · ${x.note}`}</option>)}
              </optgroup>
              <optgroup label={g.talkingGroup}>
                {d.clipModels.filter((x) => x.talking).map((x) => <option key={x.id} value={x.id}>{`${x.name} · ${usd(x.perSecond)}/s · ${x.note}`}</option>)}
              </optgroup>
            </select>
          </label>
          <span className="grow" />
          {missing.length > 0 && (
            <button type="button" className="mn-btn mn-btn--primary" onClick={() => go({ kind: "clip", shots: missing.map((s) => s.n), model, prompts, auto })}>
              {fillIn(g.makeClips, { n: missing.length })}<span className="mn-btn__cost">{usd(missing.reduce((n, s) => n + price(s), 0))}</span>
            </button>
          )}
        </Bar>
      )}
      {anySpeaks && talkM && !m.talking && (
        <label className="flex items-center gap-2 small">
          <input type="checkbox" checked={auto} disabled={!d.editable} onChange={(e) => setAuto(e.target.checked)} />
          <span>{fillIn(g.clipAuto, { model: talkM.name })}</span>
        </label>
      )}
      {m.talking && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2">{g.talkingNote}</p>}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.aspect === "9:16" ? 220 : 300}px, 1fr))` }}>
        {d.shots.map((s) => {
          const a = d.assets[`clip:${s.n}`];
          const kf = d.assets[`keyframe:${s.n}`];
          const x = modelFor(s);
          const text = promptFor(s);
          const needsLine = (m.talking || (s.speaks && auto && talkM)) && !hasLine(s.n);
          return (
            <article key={s.n} className="rounded-lg border border-line overflow-hidden flex flex-col">
              {a?.url || a?.status === "generating" ? <Media a={a} kind="video" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} /> : <Media a={kf} kind="image" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} />}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="mn-label" lang="en">{String(s.n).padStart(2, "0")}</span>
                  <span className="text-[12px] text-ink-muted grow">{fillIn(g.seconds, { n: secs(x, s.seconds) })} · {a?.url ? a.model : x.name}</span>
                  {a?.approved && <span className="mn-chip mn-chip--approved">{g.approved}</span>}
                </div>
                {s.speaks && talkM && <span className="text-[12px]" dir="auto">{fillIn(g.speaksShot, { name: s.speaker, model: x.talking ? x.name : talkM.name })}</span>}
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-ink-muted">{g.prompt}</summary>
                  <div className="mt-1.5" dir="ltr">
                    <InlineText label={g.prompt} value={text} editable={d.editable} onCommit={(v) => setPrompts((p) => ({ ...p, [String(s.n)]: v }))} />
                  </div>
                </details>
                {kf?.url && needsLine && <span className="text-[12px] text-ink-faint">{g.dialogueFirst}</span>}
                {d.editable && kf?.url && (!m.talking || hasLine(s.n)) && !r.busy && a?.status !== "generating" && (
                  <button
                    type="button"
                    className="mn-btn mn-btn--ghost mn-btn--sm self-start"
                    onClick={() => go({ kind: "clip", shots: [s.n], model, auto, prompts: prompts[String(s.n)] ? { [String(s.n)]: prompts[String(s.n)] } : {} })}
                  >
                    {a?.url ? g.remake : g.makeOne}<span className="mn-btn__cost">{usd(price(s))}</span>
                  </button>
                )}
                {!kf?.url && <span className="text-[12px] text-ink-faint">{g.keyframeFirst}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 38. Music and review ----------

export function ReviewView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const approved = d.shots.filter((s) => d.assets[`clip:${s.n}`]?.approved).length;
  const ratio = ratioOf(d.aspect);
  const music = d.assets["music:main"];
  const set = (n: number, v: boolean) =>
    start(async () => {
      const res = await approveClip(d.projectId, n, v);
      setNote(res.error);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="mn-label m-0">{g.music}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full max-w-[480px]"><Media a={music} kind="audio" alt={g.music} g={g} /></div>
        </div>
        {d.editable && (
          <Bar r={r} run={run}>
            {music?.status !== "generating" && (
              <button type="button" className="mn-btn mn-btn--secondary" onClick={() => go({ kind: "music" })}>
                {music?.url ? g.remake : g.makeMusic}<span className="mn-btn__cost">{usd(d.prices.music)}</span>
              </button>
            )}
          </Bar>
        )}
      </section>
      <p className="small m-0"><span className="data">{fillIn(g.approvedCount, { n: approved, total: d.shots.length })}</span></p>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.aspect === "9:16" ? 200 : 320}px, 1fr))` }}>
        {d.shots.map((s) => {
          const a = d.assets[`clip:${s.n}`];
          return (
            <article key={s.n} className={`rounded-lg border overflow-hidden flex flex-col ${a?.approved ? "border-ink" : "border-line"}`}>
              <Media a={a} kind="video" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} />
              <div className="p-3 flex items-center gap-2">
                <span className="mn-label" lang="en">{String(s.n).padStart(2, "0")}</span>
                <span className="small grow truncate" dir="auto">{s.action}</span>
                {a?.url && d.editable && (
                  a.approved ? (
                    <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => set(s.n, false)}>{g.reopen}</button>
                  ) : (
                    <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" disabled={pending} onClick={() => set(s.n, true)}>{g.approve}</button>
                  )
                )}
                {a?.approved && <span className="mn-chip mn-chip--approved">{g.approved}</span>}
              </div>
            </article>
          );
        })}
      </div>
      {note && <p className="small m-0" role="alert">{note}</p>}
    </div>
  );
}
