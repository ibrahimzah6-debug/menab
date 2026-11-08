"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { approveStage, saveOutputEdit } from "./actions";
import { ChangeBox } from "./editors";
import { RunLine, useCreativeRun, type RunCopy } from "./creative-run";
import { InlineText } from "./inline-doc";

// Stage 3, Look and characters: the six documents, the storyboard frames and their drawing.

type L = Dictionary["look"];
type Character = { name: string; role: string; age: string; look: string; personality: string; made_with: "ai" | "cast"; plan_a: string; plan_b: string; library_id: string | null };
type Outfit = { character: string; scene: string; outfit: string; continuity: string };
type Location = { name: string; int_ext: "INT" | "EXT"; description: string; made_with: "ai" | "real"; options: string[]; library_id: string | null };
type Art = { set: string; dressing: string; props: string[] };
type Shot = { n: number; scene: string; int_ext: string; day_night: string; size: string; angle: string; movement: string; lens: string; action: string; dialogue: string; seconds: number; cast: string[]; props: string[]; set: string };
type Frame = { n: number; scene: string; size: string; angle: string; movement: string; lens: string; action: string; dialogue: string; seconds: number; cast: string[]; set: string; prompt: string };
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

// ---------- 13. Characters ----------

export function CharactersView({ projectId, content, editable, c }: { projectId: string; content: { characters: Character[] }; editable: boolean; c: L }) {
  const { save, note } = useSave(projectId, 13);
  const k = c.characters;
  const set = (i: number, patch: Partial<Character>) => save({ ...content, characters: content.characters.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4 max-w-[980px]">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {content.characters.map((x, i) => (
          <article key={i} className="rounded-lg border border-line p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mn-chip mn-chip--ready">{x.made_with === "cast" ? k.cast : k.ai}</span>
              {x.library_id && <span className="mn-chip mn-chip--approved">{k.library}</span>}
            </div>
            <div className="h3"><InlineText label={k.name} value={x.name} editable={editable} multiline={false} onCommit={(v) => set(i, { name: v })} /></div>
            <div className="small text-ink-muted"><InlineText label={k.role} value={x.role} editable={editable} multiline={false} onCommit={(v) => set(i, { role: v })} /></div>
            <Field label={k.age}><InlineText label={k.age} value={x.age} editable={editable} multiline={false} onCommit={(v) => set(i, { age: v })} /></Field>
            <Field label={k.look}><InlineText label={k.look} value={x.look} editable={editable} onCommit={(v) => set(i, { look: v })} /></Field>
            <Field label={k.personality}><InlineText label={k.personality} value={x.personality} editable={editable} onCommit={(v) => set(i, { personality: v })} /></Field>
            <Field label={k.planA}><InlineText label={k.planA} value={x.plan_a} editable={editable} onCommit={(v) => set(i, { plan_a: v })} /></Field>
            <Field label={k.planB}><InlineText label={k.planB} value={x.plan_b} editable={editable} onCommit={(v) => set(i, { plan_b: v })} /></Field>
          </article>
        ))}
      </div>
      <Note note={note} />
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

export function LocationsView({ projectId, content, editable, c }: { projectId: string; content: { locations: Location[] }; editable: boolean; c: L }) {
  const { save, note } = useSave(projectId, 15);
  const k = c.locations;
  const set = (i: number, patch: Partial<Location>) => save({ ...content, locations: content.locations.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-4 max-w-[980px]">
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {content.locations.map((x, i) => (
          <article key={i} className="rounded-lg border border-line p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mn-label" lang="en">{x.int_ext}</span>
              <span className="mn-chip mn-chip--ready">{x.made_with === "real" ? k.real : k.ai}</span>
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

export function ShotListView({ projectId, content, seconds, editable, c }: { projectId: string; content: { shots: Shot[] }; seconds: number; editable: boolean; c: L }) {
  const { save, note } = useSave(projectId, 18);
  const k = c.shots;
  const set = (i: number, patch: Partial<Shot>) => save({ ...content, shots: content.shots.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const total = content.shots.reduce((n, x) => n + (Number(x.seconds) || 0), 0);
  const cell = (i: number, key: keyof Shot, label: string, multiline = false) => (
    <InlineText label={label} value={String(content.shots[i][key] ?? "")} editable={editable} multiline={multiline} onCommit={(v) => set(i, { [key]: v } as Partial<Shot>)} />
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="small m-0"><span className="data">{fillIn(k.total, { n: total, target: seconds })}</span></p>
      <Table
        minWidth={1320}
        head={[k.n, k.scene, k.intExt, k.dayNight, k.size, k.angle, k.movement, k.lens, k.action, k.dialogue, k.seconds, k.cast, k.props, k.set]}
        rows={content.shots.map((x, i) => [
          <span key="n" className="data">{x.n}</span>,
          cell(i, "scene", k.scene),
          <span key="ie" lang="en" className="data">{x.int_ext}</span>,
          <span key="dn" lang="en" className="data">{x.day_night}</span>,
          cell(i, "size", k.size),
          cell(i, "angle", k.angle),
          cell(i, "movement", k.movement),
          cell(i, "lens", k.lens),
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
}) {
  const { save, note } = useSave(projectId, 17);
  const r = useCreativeRun(projectId, run);
  const f = c.frames;
  const [style, setStyle] = useState<"sketch" | "photo">(initialStyle);
  const [model, setModel] = useState(initialModel);
  const [aspect, setAspect] = useState("16:9");
  // The frame shape is a per-person preference.
  useEffect(() => {
    try {
      const a = localStorage.getItem("menab-frame-aspect");
      if (a && ["16:9", "9:16", "1:1"].includes(a)) setAspect(a);
    } catch {
      // No storage: keep 16:9.
    }
  }, []);
  const pickAspect = (a: string) => {
    setAspect(a);
    try {
      localStorage.setItem("menab-frame-aspect", a);
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
            <span className="small text-ink-muted grow">{fillIn(f.count, { n: drawn.length, total: frames.length })}</span>
            {r.busy ? (
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
              </div>
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="mn-label" lang="en">{String(x.n).padStart(2, "0")}</span>
                  <span className="text-[12px] text-ink-muted grow truncate" dir="auto">{[x.size, x.angle, x.movement, x.lens].filter(Boolean).join(" · ")}</span>
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
                {editable && img?.url && !busy && !r.busy && (
                  <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm self-start" onClick={() => draw([x.n])}>
                    {f.redraw}
                    <span className="mn-btn__cost">{usd(price)}</span>
                  </button>
                )}
                {editable && !img?.url && !busy && !r.busy && (
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
  run,
}: {
  projectId: string;
  message: string;
  write: { label: string; cost: string } | null;
  approve: string | null;
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
