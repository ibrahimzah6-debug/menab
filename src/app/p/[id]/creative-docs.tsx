"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MicButton } from "@/components/mic-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { chooseDirection, restoreVersion, saveOutputEdit } from "./actions";
import { useCreativeRun, RunLine, type RunCopy } from "./creative-run";
import { InlineText } from "./inline-doc";

type C = Dictionary["creative"];
type Mic = Dictionary["mic"];
type Direction = { title: string; idea: string; story: string[]; feeling: string; why: string; references: string[]; risk: string };
type Directions = { directions: Direction[]; recommendation: string };
type Row = { scene: string; picture: string; sound: string; vo_ar: string; vo_en: string; super: string; seconds: number };
type Script = { title: string; rows: Row[]; notes: string };
type Treatment = {
  idea: string;
  tone: string;
  references: string[];
  frames: { n: number; shot_size: string; description: string; vo: string }[];
  cast: { role: string; description: string; plan_a: string; plan_b: string }[];
  wardrobe: { character: string; look: string }[];
  locations: { name: string; options: string[]; notes: string }[];
  art: { space: string; notes: string }[];
};
type Mood = { look: string; palette: { name: string; hex: string }[]; light: string; camera: string; grade: string; references: string[]; do: string[]; dont: string[] };

const fillIn = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const lines = (x: string) => x.split("\n").map((y) => y.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim()).filter(Boolean);

function useSave(projectId: string, n: number) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const save = (content: unknown) =>
    start(async () => {
      const r = await saveOutputEdit(projectId, n, content);
      setNote(r.error);
      router.refresh();
    });
  return { pending, note, save };
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="mn-label m-0 mb-1.5">{children}</h3>;
}

// ---------- 7. Creative directions ----------

export function DirectionsView({ projectId, content, chosen, editable, c }: { projectId: string; content: Directions; chosen?: number; editable: boolean; c: C }) {
  const { save, note } = useSave(projectId, 7);
  const set = (i: number, patch: Partial<Direction>) => save({ ...content, directions: content.directions.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  return (
    <div className="flex flex-col gap-4">
      <p className="small text-ink-muted m-0">{c.directionsIntro}</p>
      {content.recommendation && (
        <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" dir="auto">
          <span className="mn-label me-2">{c.recommended}</span>
          {content.recommendation}
        </p>
      )}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {content.directions.map((d, i) => (
          <article key={i} className={`rounded-lg border p-4 flex flex-col gap-3 ${chosen === i ? "border-ink" : "border-line"}`}>
            <div className="flex items-center gap-2">
              <span className="mn-label" lang="en">{String.fromCharCode(65 + i)}</span>
              {chosen === i && <span className="mn-chip mn-chip--approved">{c.chosen}</span>}
            </div>
            <div className="h3"><InlineText label={c.choose} value={d.title} editable={editable} multiline={false} onCommit={(v) => set(i, { title: v })} /></div>
            <div className="body"><InlineText label={d.title} value={d.idea} editable={editable} onCommit={(v) => set(i, { idea: v })} /></div>
            <div>
              <Label>{c.story}</Label>
              <div className="small"><InlineText label={c.story} value={d.story.map((x, k) => `${k + 1}. ${x}`).join("\n")} editable={editable} onCommit={(v) => set(i, { story: lines(v) })} /></div>
            </div>
            <div>
              <Label>{c.feeling}</Label>
              <div className="small"><InlineText label={c.feeling} value={d.feeling} editable={editable} onCommit={(v) => set(i, { feeling: v })} /></div>
            </div>
            <div>
              <Label>{c.why}</Label>
              <div className="small text-ink-muted"><InlineText label={c.why} value={d.why} editable={editable} onCommit={(v) => set(i, { why: v })} /></div>
            </div>
            {d.references.length > 0 && (
              <div>
                <Label>{c.references}</Label>
                <div className="small text-ink-muted"><InlineText label={c.references} value={d.references.join("\n")} editable={editable} onCommit={(v) => set(i, { references: lines(v) })} /></div>
              </div>
            )}
            {d.risk && (
              <div>
                <Label>{c.risk}</Label>
                <div className="small text-ink-muted"><InlineText label={c.risk} value={d.risk} editable={editable} onCommit={(v) => set(i, { risk: v })} /></div>
              </div>
            )}
          </article>
        ))}
      </div>
      {note && <p className="small m-0" role="alert">{note}</p>}
    </div>
  );
}

// ---------- 8. Creative meeting ----------

export function MeetingView({
  projectId,
  directions,
  meeting,
  editable,
  c,
  mic,
  run,
  cost,
}: {
  projectId: string;
  directions?: Directions;
  meeting?: { chosen?: number; notes?: string };
  editable: boolean;
  c: C;
  mic: Mic;
  run: RunCopy;
  cost: string;
}) {
  const [pick, setPick] = useState<number | undefined>(meeting?.chosen);
  const [notes, setNotes] = useState(meeting?.notes ?? "");
  const [error, setError] = useState<string | undefined>();
  const r = useCreativeRun(projectId, run);
  if (!directions?.directions?.length) return <p className="body text-ink-muted m-0">{c.noDirections}</p>;
  const go = async () => {
    if (pick === undefined) return setError(c.pickFirst);
    setError(undefined);
    const saved = await chooseDirection(projectId, pick, notes);
    if (saved.error) return setError(saved.error);
    await r.run({ kind: "build" });
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="small text-ink-muted m-0">{c.meetingIntro}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={c.choose}>
        {directions.directions.map((d, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={pick === i}
            disabled={!editable || r.busy}
            onClick={() => setPick(i)}
            className={`text-start rounded-lg border p-3 flex gap-3 items-start ${pick === i ? "border-ink bg-tint-1" : "border-line hover:border-line-strong"}`}
          >
            <span className={`mt-1 w-4 h-4 rounded-full border shrink-0 grid place-items-center ${pick === i ? "border-ink" : "border-line-strong"}`} aria-hidden="true">
              {pick === i && <span className="w-2 h-2 rounded-full bg-ink" />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="body font-medium" dir="auto">{String.fromCharCode(65 + i)}. {d.title}</span>
              <span className="small text-ink-muted" dir="auto">{d.idea}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="meeting-notes" className="mn-label">{c.notes}</label>
          {editable && <MicButton projectId={projectId} labels={mic} onText={(t) => setNotes((x) => (x.trim() ? `${x.trim()} ${t}` : t))} />}
        </div>
        <textarea
          id="meeting-notes"
          dir="auto"
          rows={4}
          value={notes}
          disabled={!editable || r.busy}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={c.notesPlaceholder}
          className="mn-input"
          style={{ height: "auto", paddingTop: 8, paddingBottom: 8, resize: "vertical" }}
        />
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          {r.busy ? (
            <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button>
          ) : (
            <button type="button" className="mn-btn mn-btn--primary" disabled={pick === undefined} onClick={go}>
              {meeting?.chosen !== undefined && meeting.chosen === pick ? c.rewriteAll : c.chooseAndWrite}
              <span className="mn-btn__cost">{cost}</span>
            </button>
          )}
          <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />
        </div>
      )}
      {(error || r.error) && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="alert">{error ?? r.error}</p>}
    </div>
  );
}

// ---------- 9. Script ----------

export function ScriptView({ projectId, content, seconds, editable, c }: { projectId: string; content: Script; seconds: number; editable: boolean; c: C }) {
  const { save, note } = useSave(projectId, 9);
  const s = c.script;
  const total = content.rows.reduce((n, r) => n + (Number(r.seconds) || 0), 0);
  const diff = Math.round((total - seconds) * 10) / 10;
  const setRow = (i: number, patch: Partial<Row>) => save({ ...content, rows: content.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const cell = (i: number, k: keyof Row, label: string, mono = false) => (
    <td className={`py-2 pe-3 align-top ${mono ? "data" : ""}`}>
      <InlineText
        label={label}
        value={String(content.rows[i][k] ?? "")}
        editable={editable}
        multiline={k !== "seconds"}
        onCommit={(v) => setRow(i, { [k]: k === "seconds" ? Number(v.replace(/[^0-9.]/g, "")) || content.rows[i].seconds : v } as Partial<Row>)}
      />
    </td>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h3 grow"><InlineText label={c.script.notes} value={content.title} editable={editable} multiline={false} onCommit={(v) => save({ ...content, title: v })} /></div>
        <span className="data small">{fillIn(s.total, { n: total, target: seconds })}</span>
        <span className={`mn-chip ${Math.abs(diff) <= 2 ? "mn-chip--ready" : "mn-chip--failed"}`}>{Math.abs(diff) <= 2 ? s.fits : fillIn(s.off, { d: Math.abs(diff) })}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse small min-w-[560px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col />
            <col />
            <col style={{ width: "18%" }} />
            <col style={{ width: 52 }} />
            <col style={{ width: 24 }} />
          </colgroup>
          <thead>
            <tr>{[s.scene, `${s.picture} · ${s.sound}`, `${s.vo} · ${s.voEn}`, s.super, s.seconds, ""].map((h, i) => <th key={i} className="mn-label text-start py-2 pe-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {content.rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {cell(i, "scene", s.scene, true)}
                <td className="py-2 pe-3 align-top">
                  <InlineText label={s.picture} value={r.picture} editable={editable} onCommit={(v) => setRow(i, { picture: v })} />
                  <div className="text-[12px] text-ink-muted mt-1"><InlineText label={s.sound} value={r.sound} editable={editable} onCommit={(v) => setRow(i, { sound: v })} /></div>
                </td>
                <td className="py-2 pe-3 align-top">
                  <div dir="rtl"><InlineText label={s.vo} value={r.vo_ar} editable={editable} onCommit={(v) => setRow(i, { vo_ar: v })} /></div>
                  <div className="text-[12px] text-ink-muted mt-1" dir="ltr"><InlineText label={s.voEn} value={r.vo_en} editable={editable} onCommit={(v) => setRow(i, { vo_en: v })} /></div>
                </td>
                {cell(i, "super", s.super)}
                {cell(i, "seconds", s.seconds, true)}
                <td className="py-2 align-top">
                  {editable && (
                    <button type="button" aria-label={s.remove} title={s.remove} className="text-ink-faint hover:text-ink" onClick={() => save({ ...content, rows: content.rows.filter((_, j) => j !== i) })}>
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <button
          type="button"
          className="self-start small underline text-ink-muted hover:text-ink"
          onClick={() => save({ ...content, rows: [...content.rows, { scene: String(content.rows.length + 1), picture: "", sound: "", vo_ar: "", vo_en: "", super: "", seconds: 2 }] })}
        >
          + {s.add}
        </button>
      )}
      {(content.notes || editable) && (
        <div>
          <Label>{s.notes}</Label>
          <div className="small"><InlineText label={s.notes} value={content.notes ?? ""} editable={editable} onCommit={(v) => save({ ...content, notes: v })} /></div>
        </div>
      )}
      {note && <p className="small m-0" role="alert">{note}</p>}
    </div>
  );
}

// ---------- 10. Director's treatment ----------

export function TreatmentView({ projectId, content, editable, c }: { projectId: string; content: Treatment; editable: boolean; c: C }) {
  const { save, note } = useSave(projectId, 10);
  const tr = c.treatment;
  const listOf = <K extends keyof Treatment>(k: K, i: number, patch: object) =>
    save({ ...content, [k]: (content[k] as unknown as object[]).map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const table = (head: string[], rows: React.ReactNode[][]) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse small">
        <thead><tr>{head.map((h) => <th key={h} className="mn-label text-start py-2 pe-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line align-top">{r.map((x, j) => <td key={j} className="py-2 pe-3">{x}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  return (
    <div className="flex flex-col gap-6 max-w-[980px]">
      <div><Label>{tr.idea}</Label><div className="body"><InlineText label={tr.idea} value={content.idea} editable={editable} onCommit={(v) => save({ ...content, idea: v })} /></div></div>
      <div><Label>{tr.tone}</Label><div className="small"><InlineText label={tr.tone} value={content.tone} editable={editable} onCommit={(v) => save({ ...content, tone: v })} /></div></div>
      <div><Label>{tr.references}</Label><div className="small"><InlineText label={tr.references} value={content.references.join("\n")} editable={editable} onCommit={(v) => save({ ...content, references: lines(v) })} /></div></div>
      <div>
        <Label>{tr.frames}</Label>
        {table(
          ["#", tr.size, tr.description, tr.vo],
          content.frames.map((f, i) => [
            <span key="n" className="data">{f.n}</span>,
            <InlineText key="s" label={tr.size} value={f.shot_size} editable={editable} multiline={false} onCommit={(v) => listOf("frames", i, { shot_size: v })} />,
            <InlineText key="d" label={tr.description} value={f.description} editable={editable} onCommit={(v) => listOf("frames", i, { description: v })} />,
            <InlineText key="v" label={tr.vo} value={f.vo} editable={editable} onCommit={(v) => listOf("frames", i, { vo: v })} />,
          ]),
        )}
      </div>
      <div>
        <Label>{tr.cast}</Label>
        {table(
          [tr.role, tr.description, tr.planA, tr.planB],
          content.cast.map((x, i) => [
            <InlineText key="r" label={tr.role} value={x.role} editable={editable} multiline={false} onCommit={(v) => listOf("cast", i, { role: v })} />,
            <InlineText key="d" label={tr.description} value={x.description} editable={editable} onCommit={(v) => listOf("cast", i, { description: v })} />,
            <InlineText key="a" label={tr.planA} value={x.plan_a} editable={editable} onCommit={(v) => listOf("cast", i, { plan_a: v })} />,
            <InlineText key="b" label={tr.planB} value={x.plan_b} editable={editable} onCommit={(v) => listOf("cast", i, { plan_b: v })} />,
          ]),
        )}
      </div>
      <div>
        <Label>{tr.wardrobe}</Label>
        {table(
          [tr.character, tr.look],
          content.wardrobe.map((x, i) => [
            <InlineText key="c" label={tr.character} value={x.character} editable={editable} multiline={false} onCommit={(v) => listOf("wardrobe", i, { character: v })} />,
            <InlineText key="l" label={tr.look} value={x.look} editable={editable} onCommit={(v) => listOf("wardrobe", i, { look: v })} />,
          ]),
        )}
      </div>
      <div>
        <Label>{tr.locations}</Label>
        {table(
          [tr.locations, tr.options, tr.notes],
          content.locations.map((x, i) => [
            <InlineText key="n" label={tr.locations} value={x.name} editable={editable} multiline={false} onCommit={(v) => listOf("locations", i, { name: v })} />,
            <InlineText key="o" label={tr.options} value={x.options.join("\n")} editable={editable} onCommit={(v) => listOf("locations", i, { options: lines(v) })} />,
            <InlineText key="t" label={tr.notes} value={x.notes} editable={editable} onCommit={(v) => listOf("locations", i, { notes: v })} />,
          ]),
        )}
      </div>
      <div>
        <Label>{tr.art}</Label>
        {table(
          [tr.space, tr.notes],
          content.art.map((x, i) => [
            <InlineText key="s" label={tr.space} value={x.space} editable={editable} multiline={false} onCommit={(v) => listOf("art", i, { space: v })} />,
            <InlineText key="n" label={tr.notes} value={x.notes} editable={editable} onCommit={(v) => listOf("art", i, { notes: v })} />,
          ]),
        )}
      </div>
      {note && <p className="small m-0" role="alert">{note}</p>}
    </div>
  );
}

// ---------- 11. Visual mood ----------

export function MoodView({ projectId, content, editable, c }: { projectId: string; content: Mood; editable: boolean; c: C }) {
  const { save, note } = useSave(projectId, 11);
  const m = c.mood;
  const field = (k: "look" | "light" | "camera" | "grade", label: string) => (
    <div><Label>{label}</Label><div className="small"><InlineText label={label} value={content[k]} editable={editable} onCommit={(v) => save({ ...content, [k]: v })} /></div></div>
  );
  return (
    <div className="flex flex-col gap-5 max-w-[860px]">
      <div><Label>{m.look}</Label><div className="body"><InlineText label={m.look} value={content.look} editable={editable} onCommit={(v) => save({ ...content, look: v })} /></div></div>
      <div>
        <Label>{m.palette}</Label>
        <div className="flex flex-wrap gap-3">
          {content.palette.map((p, i) => (
            <div key={i} className="flex flex-col gap-1.5 w-[96px]">
              <label className="block h-16 rounded-md border border-line overflow-hidden relative" style={{ background: /^#[0-9a-f]{6}$/i.test(p.hex) ? p.hex : "#888888" }}>
                {editable && (
                  <input
                    type="color"
                    aria-label={`${m.palette} ${p.name}`}
                    value={/^#[0-9a-f]{6}$/i.test(p.hex) ? p.hex : "#888888"}
                    onChange={(e) => save({ ...content, palette: content.palette.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)) })}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                )}
              </label>
              <span className="text-[12px]" dir="auto">{p.name}</span>
              <span className="data text-[11px] text-ink-faint">{p.hex}</span>
            </div>
          ))}
        </div>
      </div>
      {field("light", m.light)}
      {field("camera", m.camera)}
      {field("grade", m.grade)}
      <div><Label>{m.references}</Label><div className="small"><InlineText label={m.references} value={content.references.join("\n")} editable={editable} onCommit={(v) => save({ ...content, references: lines(v) })} /></div></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><Label>{m.do}</Label><div className="small"><InlineText label={m.do} value={content.do.join("\n")} editable={editable} onCommit={(v) => save({ ...content, do: lines(v) })} /></div></div>
        <div><Label>{m.dont}</Label><div className="small"><InlineText label={m.dont} value={content.dont.join("\n")} editable={editable} onCommit={(v) => save({ ...content, dont: lines(v) })} /></div></div>
      </div>
      {note && <p className="small m-0" role="alert">{note}</p>}
    </div>
  );
}

// ---------- Versions ----------

export function Versions({ projectId, n, list, current, editable, c }: { projectId: string; n: number; list: { version: number; source: string; created_at: string }[]; current: number; editable: boolean; c: C }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const router = useRouter();
  if (list.length < 2) return null;
  return (
    <div className="relative">
      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {c.versions} · {list.length}
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 end-0 w-[260px] bg-surface border border-line-strong rounded-md p-1" style={{ boxShadow: "var(--shadow-float)" }}>
          <ul className="m-0 p-0 list-none max-h-[320px] overflow-y-auto">
            {[...list].sort((a, b) => b.version - a.version).map((v) => (
              <li key={v.version} className="flex items-center gap-2 px-2 h-9 rounded-sm hover:bg-tint-2 small">
                <span className="data">v{v.version}</span>
                <span className="text-ink-muted grow truncate">{c.sources[v.source as keyof C["sources"]] ?? v.source} · {new Date(v.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" })}</span>
                {v.version === current ? (
                  <span className="text-[11px] text-ink-faint">{c.current}</span>
                ) : (
                  editable && (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[12px] underline"
                      onClick={() => start(async () => { const r = await restoreVersion(projectId, n, v.version); setNote(r.error ?? c.restored); router.refresh(); })}
                    >
                      {c.restore}
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
          {note && <p className="text-[12px] m-0 px-2 py-1.5" role="status">{note}</p>}
        </div>
      )}
    </div>
  );
}
