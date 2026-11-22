"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { browserClient } from "@/lib/supabase/client";
import { approveClip, planGenerateChange, prepareUpload, saveActorToLibrary, saveReferenceLock, type PlannedAction } from "./actions";
import { ChangeBox, type StepBox } from "./editors";
import { RunLine, useCreativeRun, type RunCopy, type StepFile } from "./creative-run";
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
  characters: { name: string; role?: string; made_with?: string; picture: string | null; library: boolean; voice: string; how: string; dialect: string; age: string; suggested: boolean; suggestions: string[]; hasLines: boolean; talkModel: string; lineSeconds: number }[];
  narrator: { voice: string; how: string; dialect: string; age: string; suggested: boolean; suggestions: string[] };
  aspect: string;
  briefAspect: string;
  skip: string[];
  products: Product[];
  locations: { name: string; picture: string | null }[];
  outfits: { key: string; character: string; outfit: string }[];
  shots: { n: number; action: string; size: string; movement: string; seconds: number; dialogue: string; frame: string | null; speaks: boolean; talkModel: string; speaker: string; clipPrompt: string; talkPrompt: string }[];
  lines: { key: string; text: string }[];
  dialogue: { key: string; n: number; speaker: string; text: string }[];
  lock: { locked?: boolean; consent?: boolean; aspect?: string; imageModel?: string };
  imageModels: { id: string; name: string; price: number; note: string }[];
  voices: { id: string; name: string; gender: "m" | "f"; desc: string }[];
  dialects: { id: string; name: string }[];
  ages: { id: string; name: string }[];
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
      // The action refreshes the page itself (revalidatePath); a second refresh only slows it.
      const res = await saveReferenceLock(projectId, patch);
      setNote(res.error);
    });
  return { save, pending, note, setNote, start, router };
}

function Bar({ children, r, run }: { children: React.ReactNode; r: ReturnType<typeof useCreativeRun>; run: RunCopy }) {
  // While it runs, the progress also shows in the bottom bar, so it stays in view while scrolling.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setSlot(document.getElementById("stage-run-slot")), []);
  return (
    <>
    {slot && r.busy && createPortal(
      <>
        <div className="min-w-0 truncate"><RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} /></div>
        <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm shrink-0" onClick={r.stop}>{run.steps.stop}</button>
      </>,
      slot,
    )}
    <div className="rounded-lg border border-line p-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">{r.busy ? <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button> : children}</div>
      {(r.busy || r.events.length > 0) && <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />}
      {r.error && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="alert">{r.error}</p>}
    </div>
    </>
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

// A voice for one character (or the narrator): the voice, described in plain words and grouped
// by women and men, the age it should sound, the dialect, how it sounds, and a button that plays
// the first line inside the app. Voices can change after the lock: they never change a picture.
type VoiceValue = { voice: string; how: string; dialect: string; age: string; suggested: boolean; suggestions: string[] };
type VoicePatch = { voice?: string; how?: string; dialect?: string; age?: string };
function VoicePick({ d, g, who, v, onSave, pending, hear, busy }: { d: GenData; g: G; who: string | null; v: VoiceValue; onSave: (p: VoicePatch) => void; pending: boolean; hear: () => void; busy: boolean }) {
  const sample = d.assets[`voicetry:try-${who ? key(who) : "narrator"}`];
  const can = d.editable && !pending;
  // The choice shows at once; the save follows.
  const [voice, setVoice] = useState(v.voice);
  useEffect(() => setVoice(v.voice), [v.voice]);
  const pick = (id: string) => {
    setVoice(id);
    onSave({ voice: id });
  };
  const label = (x: GenData["voices"][number]) => `${v.suggestions.includes(x.id) ? "★ " : ""}${x.name}: ${x.desc}`;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-muted">{g.voice}</span>
        <select className="mn-select h-8 min-w-0" value={voice} disabled={!can} onChange={(e) => pick(e.target.value)}>
          <optgroup label={g.women}>{d.voices.filter((x) => x.gender === "f").map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}</optgroup>
          <optgroup label={g.men}>{d.voices.filter((x) => x.gender === "m").map((x) => <option key={x.id} value={x.id}>{label(x)}</option>)}</optgroup>
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-ink-muted">★ {g.suggested}:</span>
        {v.suggestions.map((id) => {
          const x = d.voices.find((y) => y.id === id);
          if (!x) return null;
          return (
            <button key={id} type="button" className={`mn-chip ${voice === id ? "mn-chip--approved" : ""}`} aria-pressed={voice === id} title={x.desc} disabled={!can} onClick={() => pick(id)}>
              {voice === id && <span aria-hidden="true">✓ </span>}{x.name}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[12px] text-ink-muted">{g.age}</span>
          <select className="mn-select h-8 min-w-0" value={v.age} disabled={!can} onChange={(e) => onSave({ age: e.target.value })}>
            {d.ages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[12px] text-ink-muted">{g.dialect}</span>
          <select className="mn-select h-8 min-w-0" value={v.dialect} disabled={!can} onChange={(e) => onSave({ dialect: e.target.value })}>
            {d.dialects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-muted">{g.voiceStyle}</span>
        <input
          key={v.how}
          className="mn-input h-8 text-[13px]"
          dir="auto"
          defaultValue={v.how}
          disabled={!can}
          onBlur={(e) => {
            const x = e.target.value.trim();
            if (x !== v.how) onSave({ how: x });
          }}
        />
      </label>
      <div className="flex items-center gap-2">
        {d.editable && !busy && sample?.status !== "generating" && (
          <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm shrink-0" onClick={hear}>
            {sample?.url ? g.hearAgain : g.hear}<span className="mn-btn__cost">{usd(d.prices.voiceTry)}</span>
          </button>
        )}
        {(sample?.url || sample?.status === "generating" || sample?.status === "failed") && <div className="grow min-w-0"><Media a={sample} kind="audio" alt={g.hear} g={g} /></div>}
      </div>
    </div>
  );
}

// The talking avatar of a character who speaks on camera: the lip-sync model (or none), the
// talking picture, and a short test of that picture saying the first line in the chosen voice.
function TalkingAvatar({ d, g, c, onModel, pending, go, busy }: { d: GenData; g: G; c: GenData["characters"][number]; onModel: (id: string) => void; pending: boolean; go: (b: Record<string, unknown>) => void; busy: boolean }) {
  const k = key(c.name);
  const portrait = d.assets[`portrait:${k}`];
  const test = d.assets[`avatartry:${k}`];
  const voiceReady = Boolean(d.assets[`voicetry:try-${k}`]?.url);
  const talkers = d.clipModels.filter((x) => x.talking);
  // The choice shows at once; the save follows.
  const [model, setModel] = useState(c.talkModel);
  useEffect(() => setModel(c.talkModel), [c.talkModel]);
  const pick = (id: string) => {
    setModel(id);
    onModel(id);
  };
  const m = talkers.find((x) => x.id === model);
  const ratio = ratioOf(d.aspect);
  if (!m) return <SkipLine skipped onToggle={() => pick(talkers[0]?.id ?? "kling-avatar")} title={g.avatarTitle} editable={d.editable} g={g} />;
  return (
    <div className="rounded-md border border-line p-3 flex flex-col gap-2">
      <SkipLine skipped={false} onToggle={() => pick("off")} title={g.avatarTitle} editable={d.editable} g={g} />
      <label className="flex flex-col gap-1">
        <span className="text-[12px] text-ink-muted">{g.lipSync}</span>
        <select className="mn-select h-8" value={model} disabled={!d.editable || pending} onChange={(e) => pick(e.target.value)}>
          {talkers.map((x) => <option key={x.id} value={x.id}>{`${x.name} · ${usd(x.perSecond)}/s · ${x.note}`}</option>)}
        </select>
      </label>
      {m ? (
        <>
          <p className="text-[12px] text-ink-muted m-0">{g.avatarNote}</p>
          <div className="grid grid-cols-2 gap-2">
            <figure className="m-0 flex flex-col gap-1">
              <Media a={portrait} kind="image" alt={`${g.talkingPicture}: ${c.name}`} g={g} ratio={ratio} />
              <figcaption className="text-[11px] text-ink-muted">{g.talkingPicture}</figcaption>
            </figure>
            <figure className="m-0 flex flex-col gap-1">
              <Media a={test} kind="video" alt={`${g.talkingTest}: ${c.name}`} g={g} ratio={ratio} />
              <figcaption className="text-[11px] text-ink-muted">{g.talkingTest}</figcaption>
            </figure>
          </div>
          {d.editable && !busy && (
            <div className="flex flex-wrap items-center gap-2">
              {portrait?.status !== "generating" && (
                <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => go({ kind: "portrait", who: c.name })}>
                  {portrait?.url ? g.remakePicture : g.makePicture}<span className="mn-btn__cost">{usd(d.prices.image)}</span>
                </button>
              )}
              {portrait?.url && voiceReady && test?.status !== "generating" && (
                <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" onClick={() => go({ kind: "avatartry", who: c.name })}>
                  {test?.url ? g.remakeTest : g.makeTest}<span className="mn-btn__cost">{usd(m.perSecond * c.lineSeconds)}</span>
                </button>
              )}
            </div>
          )}
          {portrait?.url && !voiceReady && <span className="text-[12px] text-ink-faint">{g.avatarFirst}</span>}
        </>
      ) : (
        <p className="text-[12px] text-ink-muted m-0">{g.lipSyncOffNote}</p>
      )}
    </div>
  );
}

// Parts left out on purpose. The screen changes at once; the save follows in the background.
const SkipCtx = createContext<{ skips: string[]; toggle: (part: string) => void } | null>(null);
function SkipProvider({ d, children }: { d: GenData; children: React.ReactNode }) {
  const { save } = useLockSave(d.projectId);
  const [skips, setSkips] = useState(d.skip);
  const saved = d.skip.join("|");
  useEffect(() => setSkips(saved ? saved.split("|") : []), [saved]);
  const toggle = (part: string) => {
    const next = skips.includes(part) ? skips.filter((x) => x !== part) : [...skips, part];
    setSkips(next);
    save({ skip: next });
  };
  return <SkipCtx.Provider value={{ skips, toggle }}>{children}</SkipCtx.Provider>;
}
const useSkip = (d: GenData) => useContext(SkipCtx) ?? { skips: d.skip, toggle: () => {} };

// One line for a skipped part, with a button to add it back; or the part's title with "Skip".
function SkipLine({ skipped, onToggle, title, editable, g, children }: { skipped: boolean; onToggle: () => void; title: string; editable: boolean; g: G; children?: React.ReactNode }) {
  if (skipped) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-dashed border-line px-3 py-2">
        <span className="small text-ink-muted grow">{fillIn(g.skipped, { name: title })}</span>
        {editable && <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={onToggle}>{g.addBack}</button>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <h3 className="mn-label m-0 grow">{title}</h3>
      {children}
      {editable && (
        <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={onToggle} aria-label={fillIn(g.skipLabel, { name: title })} title={fillIn(g.skipLabel, { name: title })}>
          <span aria-hidden="true">✕</span> {g.skip}
        </button>
      )}
    </div>
  );
}

function SkipHeader({ d, g, part, title, children }: { d: GenData; g: G; part: string; title: string; children?: React.ReactNode }) {
  const { skips, toggle } = useSkip(d);
  return <SkipLine skipped={skips.includes(part)} onToggle={() => toggle(part)} title={title} editable={d.editable} g={g}>{children}</SkipLine>;
}

// The products that must look the same in every shot: name, what it looks like, and photos of
// the real thing. Photos go to the project's own storage first, then into the lock.
function Products({ d, g, can, go, busy }: { d: GenData; g: G; can: boolean; go: (b: Record<string, unknown>) => void; busy: boolean }) {
  const { skips } = useSkip(d);
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
  if (skips.includes("products")) return <SkipHeader d={d} g={g} part="products" title={g.productsTitle} />;
  return (
    <section className="flex flex-col gap-3">
      <SkipHeader d={d} g={g} part="products" title={g.productsTitle} />
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
            {p.name.trim() && (() => {
              const pic = d.assets[`product:${key(p.name)}`];
              return (
                <div className="flex items-center gap-3 rounded-md bg-tint-2 p-2">
                  <div className="w-[76px] shrink-0 rounded-md overflow-hidden border border-line"><Media a={pic} kind="image" alt={`${g.productPicture}: ${p.name}`} g={g} ratio="1 / 1" /></div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-[12px]">{g.productPicture}</span>
                    <span className="text-[11px] text-ink-muted">{p.photos.length ? g.productPictureFromPhotos : g.productPictureDesigned}</span>
                    {can && !busy && pic?.status !== "generating" && (
                      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" disabled={pending} onClick={() => go({ kind: "product", name: p.name })}>
                        {pic?.url ? g.remake : g.makeProductPicture}<span className="mn-btn__cost">{usd(d.prices.image)}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
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

export function ReferenceLockView(props: { d: GenData; g: G; run: RunCopy }) {
  return <SkipProvider d={props.d}><ReferenceLock {...props} /></SkipProvider>;
}

function ReferenceLock({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const skipsNow = useSkip(d).skips;
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
          {d.aspect !== d.briefAspect && <span className="text-[12px] px-2 py-1 rounded-md bg-tint-2" role="note">{fillIn(locked ? g.shapeDiffersLocked : g.shapeDiffers, { shape: iso(d.briefAspect) })}</span>}
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
                  <VoicePick
                    d={d}
                    g={g}
                    who={c.name}
                    v={c}
                    pending={pending}
                    busy={r.busy}
                    hear={() => go({ kind: "voicetry", who: c.name })}
                    onSave={(v) => save(v.voice !== undefined ? { voices: { [k]: v.voice } } : v.age !== undefined ? { ages: { [k]: v.age } } : v.dialect !== undefined ? { dialects: { [k]: v.dialect } } : { styles: { [k]: v.how ?? "" } })}
                  />
                  {c.hasLines && <TalkingAvatar d={d} g={g} c={c} pending={pending} busy={r.busy} go={go} onModel={(id) => save({ talkModels: { [k]: id }, speaks: { [k]: id !== "off" } })} />}
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

      <Products d={d} g={g} can={can} go={go} busy={r.busy} />

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
          <SkipHeader d={d} g={g} part="narrator" title={g.narrator} />
          {!skipsNow.includes("narrator") && <VoicePick
            d={d}
            g={g}
            who={null}
            v={d.narrator}
            pending={pending}
            busy={r.busy}
            hear={() => go({ kind: "voicetry", who: null })}
            onSave={(v) => save(v.voice !== undefined ? { narrator: v.voice } : v.age !== undefined ? { narratorAge: v.age } : v.dialect !== undefined ? { narratorDialect: v.dialect } : { narratorStyle: v.how ?? "" })}
          />}
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
  // A narrator left out in the reference lock has no lines to make.
  const narratorOff = useSkip(d).skips.includes("narrator");
  const vo = narratorOff ? [] : d.lines;
  const missing = vo.filter((l) => !d.assets[`voice:${l.key}`]?.url && d.assets[`voice:${l.key}`]?.status !== "generating");
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
              {fillIn(g.makeVoice, { n: missing.length })}<span className="mn-btn__cost">{usd(missing.reduce((n, l) => n + linePrice(vo.indexOf(l)), 0))}</span>
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
        <h3 className="mn-label m-0">{g.narrator}{!narratorOff && <> · <span lang="en">{voiceName(d.narrator.voice)}</span></>}</h3>
        {narratorOff ? <p className="small text-ink-muted m-0">{fillIn(g.skipped, { name: g.narrator })}</p> : vo.length === 0 && <p className="small text-ink-muted m-0">{g.noVoice}</p>}
        {vo.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col border border-line rounded-lg">
            {vo.map((l, i) => {
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
  const videoModels = d.clipModels.filter((x) => !x.talking);
  const [model, setModel] = useState(videoModels[0]?.id ?? "kling-3-0");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const m = videoModels.find((x) => x.id === model) ?? videoModels[0];
  const hasLine = (n: number) => Boolean(d.assets[`voice:dl-${n}`]?.url);
  // A shot whose character speaks on camera uses that character's talking avatar (chosen in the
  // reference lock) once the line is made; every other shot uses the video model picked here.
  const talkerOf = (s: GenData["shots"][number]) => (s.speaks ? d.clipModels.find((x) => x.id === s.talkModel) : undefined);
  const modelFor = (s: GenData["shots"][number]) => { const tk = talkerOf(s); return tk && hasLine(s.n) ? tk : m; };
  const secs = (x: GenData["clipModels"][number], s: number) => x.fixedSeconds ?? Math.max(x.min, Math.min(x.max, Math.round(s || 5)));
  const price = (s: GenData["shots"][number]) => { const x = modelFor(s); return secs(x, s.seconds) * x.perSecond; };
  const promptFor = (s: GenData["shots"][number]) => prompts[String(s.n)] ?? (modelFor(s).talking ? s.talkPrompt : s.clipPrompt);
  const missing = d.shots.filter((s) => d.assets[`keyframe:${s.n}`]?.url && !d.assets[`clip:${s.n}`]?.url && d.assets[`clip:${s.n}`]?.status !== "generating");
  const ratio = ratioOf(d.aspect);
  return (
    <div className="flex flex-col gap-4">
      {d.editable && (
        <Bar r={r} run={run}>
          <label className="flex items-center gap-2 small">
            <span className="mn-label">{g.clipModel}</span>
            <select className="mn-select h-9 max-w-[420px]" value={model} onChange={(e) => setModel(e.target.value)}>
              {videoModels.map((x) => <option key={x.id} value={x.id}>{`${x.name} · ${usd(x.perSecond)}/s · ${x.note}`}</option>)}
            </select>
          </label>
          <span className="grow" />
          {missing.length > 0 && (
            <button type="button" className="mn-btn mn-btn--primary" onClick={() => go({ kind: "clip", shots: missing.map((s) => s.n), model, prompts })}>
              {fillIn(g.makeClips, { n: missing.length })}<span className="mn-btn__cost">{usd(missing.reduce((n, s) => n + price(s), 0))}</span>
            </button>
          )}
        </Bar>
      )}
      {d.shots.some((s) => s.speaks) && <p className="small text-ink-muted m-0">{g.clipAuto}</p>}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.aspect === "9:16" ? 220 : 300}px, 1fr))` }}>
        {d.shots.map((s) => {
          const a = d.assets[`clip:${s.n}`];
          const kf = d.assets[`keyframe:${s.n}`];
          const x = modelFor(s);
          const tk = talkerOf(s);
          const text = promptFor(s);
          return (
            <article key={s.n} className="rounded-lg border border-line overflow-hidden flex flex-col">
              {a?.url || a?.status === "generating" ? <Media a={a} kind="video" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} /> : <Media a={kf} kind="image" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} />}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="mn-label" lang="en">{String(s.n).padStart(2, "0")}</span>
                  <span className="text-[12px] text-ink-muted grow">{fillIn(g.seconds, { n: secs(x, s.seconds) })} · {a?.url ? a.model : x.name}</span>
                  {a?.approved && <span className="mn-chip mn-chip--approved">{g.approved}</span>}
                </div>
                {tk && <span className="text-[12px]" dir="auto">{fillIn(g.speaksShot, { name: s.speaker, model: tk.name })}</span>}
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-ink-muted">{g.prompt}</summary>
                  <div className="mt-1.5" dir="ltr">
                    <InlineText label={g.prompt} value={text} editable={d.editable} onCommit={(v) => setPrompts((p) => ({ ...p, [String(s.n)]: v }))} />
                  </div>
                </details>
                {kf?.url && tk && !hasLine(s.n) && <span className="text-[12px] text-ink-faint">{g.dialogueFirst}</span>}
                {d.editable && kf?.url && !r.busy && a?.status !== "generating" && (
                  <button
                    type="button"
                    className="mn-btn mn-btn--ghost mn-btn--sm self-start"
                    onClick={() => go({ kind: "clip", shots: [s.n], model, prompts: prompts[String(s.n)] ? { [String(s.n)]: prompts[String(s.n)] } : {} })}
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

export function ReviewView(props: { d: GenData; g: G; run: RunCopy }) {
  return <SkipProvider d={props.d}><Review {...props} /></SkipProvider>;
}

function Review({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const skipsNow = useSkip(d).skips;
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
      {skipsNow.includes("music") ? (
        <SkipHeader d={d} g={g} part="music" title={g.music} />
      ) : (
      <section className="flex flex-col gap-2">
        <SkipHeader d={d} g={g} part="music" title={g.music} />
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
      )}
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

// ---------- Stage 5 assistant ----------

// The producer asks for anything in this stage (text, voice, photos); Menab answers with a list of
// actions and their prices. Nothing runs until Apply; each action can be unticked first.
export function GenAssistant({ d, g, run, copy, box, cost, mic }: { d: GenData; g: G; run: RunCopy; copy: { label: string; placeholder: string; apply: string; working: string }; box: StepBox; cost: string; mic: { start: string; stop: string; working: string; blocked: string } }) {
  const { r, go } = useGen(d, run);
  const [plan, setPlan] = useState<{ reply: string; actions: PlannedAction[]; files: StepFile[] } | null>(null);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [note, setNote] = useState<string | undefined>();
  const chosen = plan ? plan.actions.filter((_, i) => !off.has(i)) : [];
  const total = chosen.reduce((n, a) => n + a.price, 0);

  const apply = async () => {
    if (!plan) return;
    const files = plan.files;
    // Settings first, saved in one go: voices, skips, products and the frame shape.
    const patch: Parameters<typeof saveReferenceLock>[1] = {};
    let skips = [...d.skip];
    let products = d.products.map((p) => ({ name: p.name, description: p.description, photos: p.photos.map((x) => x.path) }));
    for (const a of chosen) {
      const k = key(a.target);
      if (a.type === "voice") {
        if (k === "narrator") Object.assign(patch, { ...(a.voice ? { narrator: a.voice } : {}), ...(a.dialect ? { narratorDialect: a.dialect } : {}), ...(a.age ? { narratorAge: a.age } : {}), ...(a.how ? { narratorStyle: a.how } : {}) });
        else {
          if (a.voice) patch.voices = { ...patch.voices, [k]: a.voice };
          if (a.dialect) patch.dialects = { ...patch.dialects, [k]: a.dialect };
          if (a.age) patch.ages = { ...patch.ages, [k]: a.age };
          if (a.how) patch.styles = { ...patch.styles, [k]: a.how };
        }
      }
      if (a.type === "skip") skips = [...new Set([...skips, k])];
      if (a.type === "addBack") skips = skips.filter((x) => x !== k);
      if (a.type === "aspect" && a.aspect) patch.aspect = a.aspect;
      if (a.type === "product" || a.type === "productPhotos") {
        const photos = a.type === "productPhotos" ? (a.files ?? []).map((i) => files[i]?.path).filter((x): x is string => Boolean(x)) : [];
        const i = products.findIndex((p) => key(p.name) === k);
        if (i < 0) products = [...products, { name: a.target, description: a.description ?? "", photos }];
        else products = products.map((p, j) => (j === i ? { ...p, description: a.type === "product" && a.description ? a.description : p.description, photos: [...p.photos, ...photos].slice(0, 4) } : p));
        patch.products = products;
      }
    }
    if (skips.join("|") !== d.skip.join("|")) patch.skip = skips;
    if (Object.keys(patch).length) {
      const res = await saveReferenceLock(d.projectId, patch);
      if (res.error) return setNote(res.error);
    }
    // Then the work that costs money, one kind at a time.
    const of = (t: PlannedAction["type"]) => chosen.filter((a) => a.type === t);
    if (of("remakeSheet").length) await go({ kind: "sheet", names: of("remakeSheet").map((a) => a.target) });
    if (of("remakeVoice").length) await go({ kind: "voice", keys: of("remakeVoice").map((a) => a.target) });
    if (of("remakeKeyframe").length) await go({ kind: "keyframe", shots: of("remakeKeyframe").map((a) => Number(a.target)), notes: Object.fromEntries(of("remakeKeyframe").map((a) => [a.target, a.description ?? ""])) });
    if (of("remakeClip").length) await go({ kind: "clip", shots: of("remakeClip").map((a) => Number(a.target)), prompts: Object.fromEntries(of("remakeClip").filter((a) => a.description).map((a) => [a.target, a.description!])) });
    if (of("remakeMusic").length) await go({ kind: "music" });
    setPlan(null);
    setOff(new Set());
    setNote(g.planDone);
  };

  return (
    <div className="flex flex-col gap-3">
      <ChangeBox
        projectId={d.projectId}
        copy={copy}
        cost={cost}
        mic={mic}
        disabled={r.busy}
        tips={box.tips}
        attach={box.attach}
        onApply={async (text, files) => {
          setNote(undefined);
          const res = await planGenerateChange(d.projectId, text, files);
          if (res.error) return { error: res.error };
          setPlan({ reply: res.reply ?? "", actions: res.actions ?? [], files });
          setOff(new Set());
          return {};
        }}
      />
      {plan && (
        <section className="rounded-md border border-line p-3 flex flex-col gap-2" aria-label={g.planTitle}>
          <span className="mn-label">{g.planTitle}</span>
          {plan.reply && <p className="small m-0" dir="auto">{plan.reply}</p>}
          {plan.actions.length === 0 ? (
            <p className="small text-ink-muted m-0">{g.planNothing}</p>
          ) : (
            <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
              {plan.actions.map((a, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 small">
                    <input type="checkbox" className="mt-1" checked={!off.has(i)} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                    <span className="grow" dir="auto">{a.say}</span>
                    <span className="data text-[12px] text-ink-muted shrink-0">{a.price ? usd(a.price) : g.free}</span>
                  </label>
                </li>
              ))}
            </ol>
          )}
          <div className="flex items-center gap-2">
            {chosen.length > 0 && (
              <button type="button" className="mn-btn mn-btn--primary mn-btn--sm grow justify-between" disabled={r.busy} onClick={() => { void apply(); }}>
                <span>{fillIn(g.planApply, { n: chosen.length })}</span>
                <span className="mn-btn__cost">{total ? usd(total) : g.free}</span>
              </button>
            )}
            <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={r.busy} onClick={() => setPlan(null)}>{g.planClear}</button>
          </div>
        </section>
      )}
      {(r.busy || r.events.length > 0) && <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />}
      {(note || r.error) && <p className="small m-0" role="status">{r.error ?? note}</p>}
    </div>
  );
}
