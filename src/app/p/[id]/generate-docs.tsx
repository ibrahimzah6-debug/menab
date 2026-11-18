"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { approveClip, saveActorToLibrary, saveReferenceLock } from "./actions";
import { RunLine, useCreativeRun, type RunCopy } from "./creative-run";
import { InlineText } from "./inline-doc";

// Stage 5, Generate: the reference lock (34), keyframes (35), clips (36), voice and music (37)
// and shot review (38). Every button shows its price before it runs.

type G = Dictionary["generate"];
export type GenAsset = { id: string; status: string; approved: boolean; model: string; prompt: string; url: string | null; version: number; seconds: number | null; cost: number | null; error: string | null };
export type GenData = {
  projectId: string;
  editable: boolean;
  lang: "en" | "ar";
  assets: Record<string, GenAsset>;
  characters: { name: string; role?: string; made_with?: string; picture: string | null; library: boolean }[];
  locations: { name: string; picture: string | null }[];
  outfits: { key: string; character: string; outfit: string }[];
  shots: { n: number; action: string; size: string; movement: string; seconds: number; dialogue: string; frame: string | null }[];
  lines: { key: string; text: string }[];
  dialogue: { key: string; n: number; speaker: string; text: string }[];
  lock: { locked?: boolean; consent?: boolean; narrator?: string; voices?: Record<string, string>; aspect?: string; imageModel?: string };
  imageModels: { id: string; name: string; price: number; note: string }[];
  voices: { id: string; name: string; gender: string; tone: string; preview: string }[];
  clipModels: { id: string; name: string; perSecond: number; fixedSeconds?: number; talking?: boolean; note: string }[];
  prices: { image: number; voiceLine: number[]; dialogueLine: number[]; music: number };
};

const iso = (x: string) => String.fromCharCode(0x2066) + x + String.fromCharCode(0x2069);
const usd = (n: number) => iso(`~$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`);
const fillIn = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const key = (s: string) => s.trim().toLowerCase().slice(0, 200);

function useGen(d: GenData, run: RunCopy) {
  const r = useCreativeRun(d.projectId, run);
  const go = (body: Record<string, unknown>) => r.run({ kind: "gen", body });
  return { r, go };
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
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const value = d.lock.imageModel ?? d.imageModels[0]?.id;
  return (
    <label className="flex flex-col gap-1.5 min-w-[280px]">
      <span className="mn-label">{g.pictureModel}</span>
      <select
        className="mn-select h-9"
        value={value}
        disabled={!d.editable || pending}
        onChange={(e) => {
          const v = e.target.value;
          start(async () => {
            const res = await saveReferenceLock(d.projectId, { imageModel: v });
            setNote(res.error);
            router.refresh();
          });
        }}
      >
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

// ---------- 34. Reference lock ----------

export function ReferenceLockView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const locked = Boolean(d.lock.locked);
  const can = d.editable && !locked;
  const save = (patch: Parameters<typeof saveReferenceLock>[1]) =>
    start(async () => {
      const res = await saveReferenceLock(d.projectId, patch);
      setNote(res.error);
      router.refresh();
    });
  const ai = d.characters.filter((c) => c.made_with !== "cast");
  const missingSheets = ai.filter((c) => !d.assets[`sheet:${key(c.name)}`]?.url && d.assets[`sheet:${key(c.name)}`]?.status !== "generating");
  const missingOutfits = d.outfits.filter((o) => !d.assets[`outfit:${o.key}`]?.url && d.assets[`outfit:${o.key}`]?.status !== "generating");
  const voiceSelect = (value: string | undefined, onChange: (v: string) => void, label: string) => (
    <div className="flex items-center gap-2">
      <select className="mn-select h-8 grow" aria-label={label} value={value ?? ""} disabled={!can || pending} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}</option>
        {d.voices.map((v) => <option key={v.id} value={v.id}>{`${v.name} · ${v.tone}`}</option>)}
      </select>
      {value && <a href={d.voices.find((v) => v.id === value)?.preview} target="_blank" rel="noopener" className="text-[12px] underline shrink-0">{g.listen}</a>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <PictureModel d={d} g={g} />
        <label className="flex flex-col gap-1.5 min-w-[260px]">
          <span className="mn-label">{g.narrator}</span>
          {voiceSelect(d.lock.narrator, (v) => save({ narrator: v }), g.narrator)}
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="mn-label">{g.shape}</span>
          <div className="mn-stagebar" role="group" aria-label={g.shape}>
            {["16:9", "9:16", "1:1"].map((a) => (
              <button key={a} type="button" lang="en" disabled={!can || pending} aria-pressed={(d.lock.aspect ?? "16:9") === a} className={`mn-stage ${(d.lock.aspect ?? "16:9") === a ? "mn-stage--current" : ""}`} onClick={() => save({ aspect: a })}>{a}</button>
            ))}
          </div>
        </div>
        <span className="grow" />
        {locked ? (
          <div className="flex items-center gap-3">
            <span className="mn-chip mn-chip--approved">{g.locked}</span>
            {d.editable && <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => save({ locked: false })}>{g.unlock}</button>}
          </div>
        ) : null}
      </div>

      {can && (missingSheets.length > 0 || missingOutfits.length > 0) && (
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

      <section className="flex flex-col gap-3">
        <h3 className="mn-label m-0">{g.characters}</h3>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {d.characters.map((c) => {
            const sheet = d.assets[`sheet:${key(c.name)}`];
            return (
              <article key={c.name} className="rounded-lg border border-line overflow-hidden flex flex-col">
                <div className="grid grid-cols-[1fr_2fr]">
                  <div className="relative bg-ground-deep" style={{ aspectRatio: "1 / 1" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.picture && <img src={c.picture} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />}
                    <span className="absolute bottom-1 start-1 text-[10px] bg-surface/90 px-1.5 rounded-sm">{g.stagePicture}</span>
                  </div>
                  {c.made_with !== "cast" ? <Media a={sheet} kind="image" alt={`${g.sheet}: ${c.name}`} g={g} ratio="16 / 9" /> : <div className="bg-ground-deep" />}
                </div>
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium grow" dir="auto">{c.name}</span>
                    {can && c.made_with !== "cast" && !r.busy && sheet?.status !== "generating" && (
                      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => go({ kind: "sheet", names: [c.name] })}>
                        {sheet?.url ? g.remake : g.makeSheet}<span className="mn-btn__cost">{usd(d.prices.image)}</span>
                      </button>
                    )}
                  </div>
                  {voiceSelect(d.lock.voices?.[key(c.name)], (v) => save({ voices: { [key(c.name)]: v } }), g.voice)}
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

// ---------- 35. Keyframes ----------

export function KeyframesView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const can = d.editable && Boolean(d.lock.locked);
  const ratio = d.lock.aspect === "9:16" ? "9 / 16" : d.lock.aspect === "1:1" ? "1 / 1" : "16 / 9";
  const missing = d.shots.filter((s) => !d.assets[`keyframe:${s.n}`]?.url && d.assets[`keyframe:${s.n}`]?.status !== "generating");
  return (
    <div className="flex flex-col gap-4">
      {!d.lock.locked && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2">{g.lockFirst}</p>}
      {d.lock.locked && <PictureModel d={d} g={g} />}
      {can && missing.length > 0 && (
        <Bar r={r} run={run}>
          <button type="button" className="mn-btn mn-btn--primary" onClick={() => go({ kind: "keyframe", shots: missing.map((s) => s.n) })}>
            {fillIn(g.makeKeyframes, { n: missing.length })}<span className="mn-btn__cost">{usd(d.prices.image * missing.length)}</span>
          </button>
        </Bar>
      )}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.lock.aspect === "9:16" ? 180 : 260}px, 1fr))` }}>
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

// ---------- 36. Video clips ----------

export function ClipsView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const [model, setModel] = useState(d.clipModels[0]?.id ?? "kling-3-0");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const m = d.clipModels.find((x) => x.id === model) ?? d.clipModels[0];
  const secs = (s: number) => m.fixedSeconds ?? Math.max(3, Math.min(15, Math.round(s || 5)));
  const price = (s: number) => secs(s) * m.perSecond;
  const talking = Boolean(m.talking);
  const hasLine = (n: number) => Boolean(d.assets[`voice:dl-${n}`]?.url);
  const ready = d.shots.filter((s) => d.assets[`keyframe:${s.n}`]?.url && (!talking || hasLine(s.n)));
  const missing = ready.filter((s) => !d.assets[`clip:${s.n}`]?.url && d.assets[`clip:${s.n}`]?.status !== "generating");
  const ratio = d.lock.aspect === "9:16" ? "9 / 16" : d.lock.aspect === "1:1" ? "1 / 1" : "16 / 9";
  return (
    <div className="flex flex-col gap-4">
      {d.editable && (
        <Bar r={r} run={run}>
          <label className="flex items-center gap-2 small">
            <span className="mn-label">{g.clipModel}</span>
            <select className="mn-select h-9" value={model} onChange={(e) => setModel(e.target.value)}>
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
            <button type="button" className="mn-btn mn-btn--primary" onClick={() => go({ kind: "clip", shots: missing.map((s) => s.n), model, prompts })}>
              {fillIn(g.makeClips, { n: missing.length })}<span className="mn-btn__cost">{usd(missing.reduce((n, s) => n + price(s.seconds), 0))}</span>
            </button>
          )}
        </Bar>
      )}
      {talking && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2">{g.talkingNote}</p>}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.lock.aspect === "9:16" ? 200 : 300}px, 1fr))` }}>
        {d.shots.map((s) => {
          const a = d.assets[`clip:${s.n}`];
          const kf = d.assets[`keyframe:${s.n}`];
          const text = prompts[String(s.n)] ?? a?.prompt ?? `${s.action}. Camera move: ${s.movement}.`;
          return (
            <article key={s.n} className="rounded-lg border border-line overflow-hidden flex flex-col">
              {a?.url || a?.status === "generating" ? <Media a={a} kind="video" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} /> : <Media a={kf} kind="image" alt={fillIn(g.shot, { n: s.n })} g={g} ratio={ratio} />}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="mn-label" lang="en">{String(s.n).padStart(2, "0")}</span>
                  <span className="text-[12px] text-ink-muted grow">{fillIn(g.seconds, { n: secs(s.seconds) })} · {a?.model ?? m.name}</span>
                  {a?.approved && <span className="mn-chip mn-chip--approved">{g.approved}</span>}
                </div>
                <details className="text-[12px]">
                  <summary className="cursor-pointer text-ink-muted">{g.prompt}</summary>
                  <div className="mt-1.5" dir="auto">
                    <InlineText label={g.prompt} value={text} editable={d.editable} onCommit={(v) => setPrompts((p) => ({ ...p, [String(s.n)]: v }))} />
                  </div>
                </details>
                {talking && kf?.url && !hasLine(s.n) && <span className="text-[12px] text-ink-faint">{g.dialogueFirst}</span>}
                {d.editable && kf?.url && (!talking || hasLine(s.n)) && !r.busy && a?.status !== "generating" && (
                  <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" onClick={() => go({ kind: "clip", shots: [s.n], model, prompts: { [String(s.n)]: text } })}>
                    {a?.url ? g.remake : g.makeOne}<span className="mn-btn__cost">{usd(price(s.seconds))}</span>
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

// ---------- 37. Voice and music ----------

export function SoundView({ d, g, run }: { d: GenData; g: G; run: RunCopy }) {
  const { r, go } = useGen(d, run);
  const missing = d.lines.filter((l) => !d.assets[`voice:${l.key}`]?.url && d.assets[`voice:${l.key}`]?.status !== "generating");
  const music = d.assets["music:main"];
  const missingDialogue = d.dialogue.filter((l) => !d.assets[`voice:${l.key}`]?.url && d.assets[`voice:${l.key}`]?.status !== "generating");
  const dlPrice = (i: number) => d.prices.dialogueLine[i] ?? 0.001;
  const linePrice = (i: number) => d.prices.voiceLine[i] ?? 0.001;
  return (
    <div className="flex flex-col gap-5">
      {d.editable && (
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
          {music?.status !== "generating" && (
            <button type="button" className="mn-btn mn-btn--secondary" onClick={() => go({ kind: "music" })}>
              {music?.url ? g.remake : g.makeMusic}<span className="mn-btn__cost">{usd(d.prices.music)}</span>
            </button>
          )}
        </Bar>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="mn-label m-0">{g.narrator}</h3>
        {d.lines.length === 0 && <p className="small text-ink-muted m-0">{g.noVoice}</p>}
        <ul className="m-0 p-0 list-none flex flex-col border border-line rounded-lg">
          {d.lines.map((l, i) => {
            const a = d.assets[`voice:${l.key}`];
            return (
              <li key={l.key} className={`grid gap-3 items-center px-4 py-3 ${i ? "border-t border-line" : ""}`} style={{ gridTemplateColumns: "40px 1fr 260px auto" }}>
                <span className="mn-label" lang="en">{String(i + 1).padStart(2, "0")}</span>
                <span className="small" dir="auto">{l.text}</span>
                <Media a={a} kind="audio" alt={l.text} g={g} />
                {d.editable && !r.busy && a?.status !== "generating" ? (
                  <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={() => go({ kind: "voice", keys: [l.key] })}>
                    {a?.url ? g.remake : g.makeOne}<span className="mn-btn__cost">{usd(linePrice(i))}</span>
                  </button>
                ) : <span />}
              </li>
            );
          })}
        </ul>
      </section>
      {d.dialogue.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="mn-label m-0">{g.dialogueTitle}</h3>
          <p className="small text-ink-muted m-0">{g.dialogueNote}</p>
          <ul className="m-0 p-0 list-none flex flex-col border border-line rounded-lg">
            {d.dialogue.map((l, i) => {
              const a = d.assets[`voice:${l.key}`];
              return (
                <li key={l.key} className={`grid gap-3 items-center px-4 py-3 ${i ? "border-t border-line" : ""}`} style={{ gridTemplateColumns: "120px 1fr 260px auto" }}>
                  <span className="text-[12px] text-ink-muted" dir="auto">{fillIn(g.dialogue, { n: l.n, name: l.speaker })}</span>
                  <span className="small" dir="auto">{l.text}</span>
                  <Media a={a} kind="audio" alt={l.text} g={g} />
                  {d.editable && !r.busy && a?.status !== "generating" ? (
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
      <section className="flex flex-col gap-2">
        <h3 className="mn-label m-0">{g.music}</h3>
        <div className="max-w-[480px]"><Media a={music} kind="audio" alt={g.music} g={g} /></div>
      </section>
    </div>
  );
}

// ---------- 38. Shot review ----------

export function ReviewView({ d, g }: { d: GenData; g: G }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const approved = d.shots.filter((s) => d.assets[`clip:${s.n}`]?.approved).length;
  const ratio = d.lock.aspect === "9:16" ? "9 / 16" : d.lock.aspect === "1:1" ? "1 / 1" : "16 / 9";
  const set = (n: number, v: boolean) =>
    start(async () => {
      const res = await approveClip(d.projectId, n, v);
      setNote(res.error);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-4">
      <p className="small m-0"><span className="data">{fillIn(g.approvedCount, { n: approved, total: d.shots.length })}</span></p>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${d.lock.aspect === "9:16" ? 200 : 320}px, 1fr))` }}>
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
