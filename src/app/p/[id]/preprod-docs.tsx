"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEPARTMENTS, department } from "@/lib/crew";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { approveStage, saveOutputEdit } from "./actions";
import { ChangeBox, type StepBox } from "./editors";
import { RunLine, useCreativeRun, type RunCopy } from "./creative-run";
import { InlineText } from "./inline-doc";

// Stage 4, Pre-production: budget (20), crew list (22), permits (25), equipment (26), PPM
// booklet (27), PPM meeting (28), shooting schedule (31) and call sheets (32).

type P = Dictionary["preprod"];
type Item = { item: string; qty: number; unit: string; days: number; rate: number; total: number };
type Budget = { currency: string; sections: { name: string; items: Item[] }[]; contingency_pct: number; fee_pct: number; vat_pct: number; notes: string };
type Need = { department: string; role: string; count: number; days: number };
type Member = { crew_id: string; role: string };
export type CrewRow = { id: string; name: string; role: string | null; department: string | null; phone: string | null; gamr_status: string; id_last4: string | null };
type Permits = { purpose: string; type: string; locations: { region: string; city: string; place: string; public_place: boolean; needs_venue_approval: boolean }[]; drone: boolean; dates: string; checklist: string[] };
type Day = { day: number; date: string; sets: { time: string; set: string; scene: string; int_ext: string; day_night: string; shots: number[]; cast: string[]; props: string[]; prep_minutes: number }[] };
type Sheet = { day: number; date: string; crew_call: string; client_call: string; first_roll: string; meals: string; wrap: string; sunrise: string; sunset: string; weather: string; locations: { name: string; address: string; map_link: string; parking: string; contact: string }[]; nearest_hospital: string; safety: string[] };

const lines = (x: string) => x.split("\n").map((y) => y.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim()).filter(Boolean);
const sar = (n: number) => String.fromCharCode(0x2066) + `${Math.round(n).toLocaleString("en-US")} SAR` + String.fromCharCode(0x2069);
const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v.trim() !== "" ? Number(v) : fallback);

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
        <thead><tr>{head.map((h, i) => <th key={i} className="mn-label text-start py-2 pe-3 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line align-top">{r.map((x, j) => <td key={j} className="py-2 pe-3">{x}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
const Note = ({ note }: { note?: string }) => (note ? <p className="small m-0" role="alert">{note}</p> : null);

export function budgetTotals(b: Budget) {
  const subtotal = b.sections.flatMap((s) => s.items).reduce((n, i) => n + (Number(i.qty) || 0) * (Number(i.days) || 1) * (Number(i.rate) || 0), 0);
  const contingency = (subtotal * (Number(b.contingency_pct) || 0)) / 100;
  const fee = ((subtotal + contingency) * (Number(b.fee_pct) || 0)) / 100;
  const vat = ((subtotal + contingency + fee) * 15) / 100;
  return { subtotal, contingency, fee, vat, total: subtotal + contingency + fee + vat };
}

// ---------- 20. Budget and quote ----------

export function BudgetView({ projectId, content, editable, c }: { projectId: string; content: { budget: Budget }; editable: boolean; c: P }) {
  const { save, note } = useSave(projectId, 20);
  const b = content.budget;
  const k = c.budget;
  const setItem = (si: number, ii: number, patch: Partial<Item>) => {
    const sections = b.sections.map((s, a) => (a !== si ? s : { ...s, items: s.items.map((it, j) => (j !== ii ? it : { ...it, ...patch, total: 0 })) }));
    const fixed = sections.map((s) => ({ ...s, items: s.items.map((it) => ({ ...it, total: Math.round((Number(it.qty) || 0) * (Number(it.days) || 1) * (Number(it.rate) || 0)) })) }));
    save({ budget: { ...b, sections: fixed } });
  };
  const tt = budgetTotals(b);
  const edit = (si: number, ii: number, key: keyof Item, value: number | string, text = false) => (
    <InlineText label={k[key as keyof typeof k] as string ?? String(key)} value={String(value)} editable={editable} multiline={false} onCommit={(v) => setItem(si, ii, { [key]: text ? v : num(v, Number(value) || 0) } as Partial<Item>)} />
  );
  return (
    <div className="flex flex-col gap-5 max-w-[1000px]">
      {b.sections.map((s, si) => (
        <section key={si} className="flex flex-col gap-1">
          <h3 className="mn-label m-0" dir="auto">{s.name}</h3>
          <Table
            head={[k.item, k.qty, k.unit, k.days, k.rate, k.total]}
            rows={s.items.map((it, ii) => [
              <div key="i" className="min-w-[220px]">{edit(si, ii, "item", it.item, true)}</div>,
              edit(si, ii, "qty", it.qty),
              edit(si, ii, "unit", it.unit, true),
              edit(si, ii, "days", it.days),
              edit(si, ii, "rate", it.rate),
              <span key="t" className="data whitespace-nowrap">{sar((Number(it.qty) || 0) * (Number(it.days) || 1) * (Number(it.rate) || 0))}</span>,
            ])}
          />
        </section>
      ))}
      <div className="self-end w-full max-w-[380px] rounded-lg border border-line p-4 flex flex-col gap-1.5 small">
        <div className="flex justify-between"><span>{k.subtotal}</span><span className="data">{sar(tt.subtotal)}</span></div>
        <div className="flex justify-between items-center gap-2"><span className="flex items-center gap-1">{k.contingency} <InlineText label={k.contingency} value={String(b.contingency_pct)} editable={editable} multiline={false} onCommit={(v) => save({ budget: { ...b, contingency_pct: num(v, b.contingency_pct) } })} />%</span><span className="data">{sar(tt.contingency)}</span></div>
        <div className="flex justify-between items-center gap-2"><span className="flex items-center gap-1">{k.fee} <InlineText label={k.fee} value={String(b.fee_pct)} editable={editable} multiline={false} onCommit={(v) => save({ budget: { ...b, fee_pct: num(v, b.fee_pct) } })} />%</span><span className="data">{sar(tt.fee)}</span></div>
        <div className="flex justify-between"><span>{k.vat}</span><span className="data">{sar(tt.vat)}</span></div>
        <div className="flex justify-between border-t border-line pt-2 font-medium"><span>{k.grand}</span><span className="data">{sar(tt.total)}</span></div>
      </div>
      {b.notes && <div><h3 className="mn-label m-0 mb-1">{k.notes}</h3><div className="small"><InlineText label={k.notes} value={b.notes} editable={editable} onCommit={(v) => save({ budget: { ...b, notes: v } })} /></div></div>}
      <p className="text-[12px] text-ink-faint m-0">{k.reference}</p>
      <Note note={note} />
    </div>
  );
}

// ---------- 22. Crew list ----------

export function CrewView({ projectId, content, editable, c, crew, lang }: { projectId: string; content: { needs: Need[]; members: Member[] }; editable: boolean; c: P; crew: CrewRow[]; lang: "en" | "ar" }) {
  const { save, note } = useSave(projectId, 22);
  const k = c.crew;
  const members = content.members ?? [];
  const [pick, setPick] = useState({ crew_id: "", role: "" });
  const person = (id: string) => crew.find((x) => x.id === id);
  const unregistered = members.filter((m) => person(m.crew_id) && person(m.crew_id)!.gamr_status !== "registered");
  return (
    <div className="flex flex-col gap-5 max-w-[1000px]">
      <section className="flex flex-col gap-2">
        <h3 className="mn-label m-0">{k.needs}</h3>
        <Table
          head={[k.department, k.role, k.count, k.days]}
          rows={(content.needs ?? []).map((n, i) => [
            <span key="d">{department(n.department)?.[lang] ?? n.department}</span>,
            <InlineText key="r" label={k.role} value={n.role} editable={editable} multiline={false} onCommit={(v) => save({ ...content, needs: content.needs.map((x, j) => (j === i ? { ...x, role: v } : x)) })} />,
            <InlineText key="c" label={k.count} value={String(n.count)} editable={editable} multiline={false} onCommit={(v) => save({ ...content, needs: content.needs.map((x, j) => (j === i ? { ...x, count: num(v, n.count) } : x)) })} />,
            <InlineText key="y" label={k.days} value={String(n.days)} editable={editable} multiline={false} onCommit={(v) => save({ ...content, needs: content.needs.map((x, j) => (j === i ? { ...x, days: num(v, n.days) } : x)) })} />,
          ])}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="mn-label m-0">{k.members}</h3>
        {unregistered.length > 0 && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="status">{k.gamrWarning.replace("{names}", unregistered.map((m) => person(m.crew_id)!.name).join(", "))}</p>}
        <Table
          head={[k.name, k.department, k.role, k.phone, k.gamr, k.id, ""]}
          rows={members.map((m, i) => {
            const p = person(m.crew_id);
            return [
              <span key="n" dir="auto">{p?.name ?? "–"}</span>,
              <span key="d">{department(p?.department)?.[lang] ?? "–"}</span>,
              <span key="r" dir="auto">{m.role || p?.role || "–"}</span>,
              <span key="p" dir="ltr">{p?.phone ?? "–"}</span>,
              <span key="g" className={`mn-chip ${p?.gamr_status === "registered" ? "mn-chip--approved" : p?.gamr_status === "not_registered" ? "mn-chip--failed" : "mn-chip--waiting"}`}>{k.gamrStatus[(p?.gamr_status ?? "unknown") as keyof P["crew"]["gamrStatus"]]}</span>,
              <span key="i" className="data" dir="ltr">{p?.id_last4 ? `•••••• ${p.id_last4}` : "–"}</span>,
              editable ? <button key="x" type="button" className="text-[12px] underline text-ink-muted" onClick={() => save({ ...content, members: members.filter((_, j) => j !== i) })}>{k.remove}</button> : <span key="x" />,
            ];
          })}
        />
        {members.length === 0 && <p className="small text-ink-muted m-0">{k.empty}</p>}
        {editable && (
          <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (pick.crew_id) { save({ ...content, members: [...members, pick] }); setPick({ crew_id: "", role: "" }); } }}>
            <label className="flex flex-col gap-1 min-w-[240px]">
              <span className="mn-label">{k.add}</span>
              <select className="mn-select h-9" value={pick.crew_id} onChange={(e) => setPick({ crew_id: e.target.value, role: person(e.target.value)?.role ?? "" })}>
                <option value="">–</option>
                {DEPARTMENTS.map((d) => {
                  const list = crew.filter((x) => x.department === d.id && !members.some((m) => m.crew_id === x.id));
                  return list.length ? <optgroup key={d.id} label={d[lang]}>{list.map((x) => <option key={x.id} value={x.id}>{`${x.name}${x.role ? ` · ${x.role}` : ""}`}</option>)}</optgroup> : null;
                })}
                {crew.filter((x) => !x.department && !members.some((m) => m.crew_id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1"><span className="mn-label">{k.role}</span><input className="mn-input h-9" value={pick.role} onChange={(e) => setPick({ ...pick, role: e.target.value })} /></label>
            <button type="submit" className="mn-btn mn-btn--secondary" disabled={!pick.crew_id}>{k.addButton}</button>
            <a href="/team" className="small underline self-center">{k.directory}</a>
          </form>
        )}
      </section>
      <Note note={note} />
    </div>
  );
}

// ---------- 25. Permits ----------

export function PermitsView({ projectId, content, editable, c }: { projectId: string; content: { permits: Permits }; editable: boolean; c: P }) {
  const { save, note } = useSave(projectId, 25);
  const p = content.permits;
  const k = c.permits;
  const set = (patch: Partial<Permits>) => save({ permits: { ...p, ...patch } });
  return (
    <div className="flex flex-col gap-5 max-w-[1000px]">
      <div className="grid gap-4 md:grid-cols-2">
        <div><h3 className="mn-label m-0 mb-1">{k.purpose}</h3><div className="small"><InlineText label={k.purpose} value={p.purpose} editable={editable} onCommit={(v) => set({ purpose: v })} /></div></div>
        <div><h3 className="mn-label m-0 mb-1">{k.dates}</h3><div className="small"><InlineText label={k.dates} value={p.dates} editable={editable} multiline={false} onCommit={(v) => set({ dates: v })} /></div></div>
      </div>
      <section className="flex flex-col gap-1">
        <h3 className="mn-label m-0">{k.locations}</h3>
        <Table
          head={[k.region, k.city, k.place, k.public, k.venue]}
          rows={p.locations.map((l, i) => [
            <InlineText key="r" label={k.region} value={l.region} editable={editable} multiline={false} onCommit={(v) => set({ locations: p.locations.map((x, j) => (j === i ? { ...x, region: v } : x)) })} />,
            <InlineText key="c" label={k.city} value={l.city} editable={editable} multiline={false} onCommit={(v) => set({ locations: p.locations.map((x, j) => (j === i ? { ...x, city: v } : x)) })} />,
            <InlineText key="p" label={k.place} value={l.place} editable={editable} multiline={false} onCommit={(v) => set({ locations: p.locations.map((x, j) => (j === i ? { ...x, place: v } : x)) })} />,
            <span key="u">{l.public_place ? k.yes : k.no}</span>,
            <span key="v" className={`mn-chip ${l.needs_venue_approval ? "mn-chip--waiting" : "mn-chip--ready"}`}>{l.needs_venue_approval ? k.venueNeeded : k.no}</span>,
          ])}
        />
      </section>
      {p.drone && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2">{k.drone}</p>}
      <div><h3 className="mn-label m-0 mb-1">{k.checklist}</h3><div className="small"><InlineText label={k.checklist} value={p.checklist.map((x, i) => `${i + 1}. ${x}`).join("\n")} editable={editable} onCommit={(v) => set({ checklist: lines(v) })} /></div></div>
      <a href={`/print/${projectId}/permit?print=1`} target="_blank" rel="noopener" className="mn-btn mn-btn--secondary self-start">{k.savePdf}</a>
      <p className="text-[12px] text-ink-faint m-0">{k.idNote}</p>
      <Note note={note} />
    </div>
  );
}

// ---------- 26. Equipment ----------

export function EquipmentView({ projectId, content, editable, c, lang }: { projectId: string; content: { equipment: { department: string; item: string; qty: number; notes: string }[] }; editable: boolean; c: P; lang: "en" | "ar" }) {
  const { save, note } = useSave(projectId, 26);
  const k = c.equipment;
  const list = content.equipment ?? [];
  const set = (i: number, patch: object) => save({ equipment: list.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="flex flex-col gap-3 max-w-[1000px]">
      <Table
        head={[k.department, k.item, k.qty, k.notes]}
        rows={list.map((x, i) => [
          <span key="d">{department(x.department)?.[lang] ?? x.department}</span>,
          <InlineText key="i" label={k.item} value={x.item} editable={editable} multiline={false} onCommit={(v) => set(i, { item: v })} />,
          <InlineText key="q" label={k.qty} value={String(x.qty)} editable={editable} multiline={false} onCommit={(v) => set(i, { qty: num(v, x.qty) })} />,
          <InlineText key="n" label={k.notes} value={x.notes} editable={editable} onCommit={(v) => set(i, { notes: v })} />,
        ])}
      />
      <Note note={note} />
    </div>
  );
}

// ---------- 27. PPM booklet ----------

export function PpmView({ projectId, sections, c }: { projectId: string; sections: { label: string; ready: boolean }[]; c: P }) {
  return (
    <div className="flex flex-col gap-4 max-w-[760px]">
      <ul className="m-0 p-0 list-none flex flex-col border border-line rounded-lg">
        {sections.map((s, i) => (
          <li key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i ? "border-t border-line" : ""}`}>
            <span className="mn-label" lang="en">{String(i + 1).padStart(2, "0")}</span>
            <span className="small grow">{s.label}</span>
            <span className={`mn-chip ${s.ready ? "mn-chip--ready" : "mn-chip--waiting"}`}>{s.ready ? c.ready : c.waiting}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <a href={`/print/${projectId}/ppm?print=1`} target="_blank" rel="noopener" className="mn-btn mn-btn--secondary">{c.savePpm}</a>
        <a href={`/print/${projectId}/ppm`} target="_blank" rel="noopener" className="mn-btn mn-btn--ghost">{c.open}</a>
      </div>
    </div>
  );
}

// ---------- 28. PPM meeting ----------

export function MeetingView({ projectId, content, editable, c }: { projectId: string; content: { client?: string; date?: string; signed?: boolean; changes?: string[] } | undefined; editable: boolean; c: P }) {
  const { save, note } = useSave(projectId, 28);
  const m = content ?? {};
  const k = c.meeting;
  const set = (patch: object) => save({ ...m, ...patch });
  return (
    <div className="flex flex-col gap-4 max-w-[760px]">
      <div className="grid gap-4 md:grid-cols-2">
        <div><h3 className="mn-label m-0 mb-1">{k.client}</h3><div className="small"><InlineText label={k.client} value={m.client ?? ""} editable={editable} multiline={false} onCommit={(v) => set({ client: v })} /></div></div>
        <div><h3 className="mn-label m-0 mb-1">{k.date}</h3><div className="small"><InlineText label={k.date} value={m.date ?? ""} editable={editable} multiline={false} onCommit={(v) => set({ date: v })} /></div></div>
      </div>
      <div><h3 className="mn-label m-0 mb-1">{k.changes}</h3><div className="small"><InlineText label={k.changes} value={(m.changes ?? []).map((x, i) => `${i + 1}. ${x}`).join("\n")} editable={editable} onCommit={(v) => set({ changes: lines(v) })} /></div></div>
      <label className="flex items-start gap-2 small">
        <input type="checkbox" className="mt-1" checked={Boolean(m.signed)} disabled={!editable} onChange={(e) => set({ signed: e.target.checked })} />
        <span>{k.signed}</span>
      </label>
      <Note note={note} />
    </div>
  );
}

// ---------- 31. Shooting schedule ----------

export function ScheduleView({ projectId, content, editable, c }: { projectId: string; content: { schedule: Day[] }; editable: boolean; c: P }) {
  const { save, note } = useSave(projectId, 31);
  const k = c.schedule;
  const days = content.schedule ?? [];
  const setSet = (d: number, s: number, patch: object) => save({ schedule: days.map((x, i) => (i !== d ? x : { ...x, sets: x.sets.map((y, j) => (j === s ? { ...y, ...patch } : y)) })) });
  return (
    <div className="flex flex-col gap-5">
      {days.map((d, di) => (
        <section key={di} className="flex flex-col gap-1">
          <h3 className="h3 m-0">{k.day.replace("{n}", String(d.day)).replace("{total}", String(days.length))} · <span className="small text-ink-muted"><InlineText label={k.date} value={d.date} editable={editable} multiline={false} onCommit={(v) => save({ schedule: days.map((x, i) => (i === di ? { ...x, date: v } : x)) })} /></span></h3>
          <Table
            minWidth={900}
            head={[k.time, k.set, k.scene, k.intExt, k.dayNight, k.shots, k.cast, k.props, k.prep]}
            rows={d.sets.map((s, si) => [
              <InlineText key="t" label={k.time} value={s.time} editable={editable} multiline={false} onCommit={(v) => setSet(di, si, { time: v })} />,
              <span key="s" dir="auto">{s.set}</span>,
              <span key="c">{s.scene}</span>,
              <span key="i" className="data">{s.int_ext}</span>,
              <span key="d" className="data">{s.day_night}</span>,
              <span key="h" className="data">{s.shots.join(", ")}</span>,
              <span key="a" dir="auto">{s.cast.join(", ")}</span>,
              <span key="p" dir="auto">{s.props.join(", ")}</span>,
              <span key="m" className="data">{s.prep_minutes}′</span>,
            ])}
          />
        </section>
      ))}
      <Note note={note} />
    </div>
  );
}

// ---------- 32. Call sheets ----------

export function CallSheetsView({ projectId, content, editable, c }: { projectId: string; content: { call_sheets: Sheet[] }; editable: boolean; c: P }) {
  const { save, note } = useSave(projectId, 32);
  const k = c.calls;
  const sheets = content.call_sheets ?? [];
  const set = (i: number, patch: Partial<Sheet>) => save({ call_sheets: sheets.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const field = (i: number, key: keyof Sheet, label: string) => (
    <div><span className="mn-label block">{label}</span><span className="small"><InlineText label={label} value={String(sheets[i][key] ?? "")} editable={editable} multiline={false} onCommit={(v) => set(i, { [key]: v } as Partial<Sheet>)} /></span></div>
  );
  return (
    <div className="flex flex-col gap-5">
      {sheets.map((s, i) => (
        <article key={i} className="rounded-lg border border-line p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="h3 m-0 grow">{k.day.replace("{n}", String(s.day)).replace("{total}", String(sheets.length))} · <span className="small text-ink-muted">{s.date}</span></h3>
            <a href={`/print/${projectId}/call-sheet-${s.day}?print=1`} target="_blank" rel="noopener" className="mn-btn mn-btn--secondary mn-btn--sm">{k.savePdf}</a>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {field(i, "crew_call", k.crewCall)}
            {field(i, "client_call", k.clientCall)}
            {field(i, "first_roll", k.roll)}
            {field(i, "meals", k.meals)}
            {field(i, "wrap", k.wrap)}
            {field(i, "sunrise", k.sunrise)}
            {field(i, "sunset", k.sunset)}
            {field(i, "weather", k.weather)}
          </div>
          <Table
            head={[k.location, k.address, k.parking, k.contact]}
            rows={s.locations.map((l, li) => [
              <span key="n" dir="auto">{l.name}</span>,
              l.map_link ? <a key="a" href={l.map_link} target="_blank" rel="noopener" className="underline" dir="auto">{l.address}</a> : <span key="a" dir="auto">{l.address}</span>,
              <InlineText key="p" label={k.parking} value={l.parking} editable={editable} multiline={false} onCommit={(v) => set(i, { locations: s.locations.map((x, j) => (j === li ? { ...x, parking: v } : x)) })} />,
              <InlineText key="c" label={k.contact} value={l.contact} editable={editable} multiline={false} onCommit={(v) => set(i, { locations: s.locations.map((x, j) => (j === li ? { ...x, contact: v } : x)) })} />,
            ])}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {field(i, "nearest_hospital", k.hospital)}
            <div><span className="mn-label block">{k.emergency}</span><span className="small" dir="ltr">911 · 997 · 998 · 999</span></div>
          </div>
          <div><span className="mn-label block">{k.safety}</span><span className="small"><InlineText label={k.safety} value={s.safety.map((x, j) => `${j + 1}. ${x}`).join("\n")} editable={editable} onCommit={(v) => set(i, { safety: lines(v) })} /></span></div>
        </article>
      ))}
      <p className="text-[12px] text-ink-faint m-0">{k.crewNote}</p>
      <Note note={note} />
    </div>
  );
}

// ---------- Writing the stage ----------

export function PreprodFooter({ projectId, stageNumber, message, write, approve, run }: { projectId: string; stageNumber: number; message: string; write: { label: string; cost: string } | null; approve: string | null; run: RunCopy }) {
  const r = useCreativeRun(projectId, run);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  return (
    <footer className="shrink-0 sticky bottom-0 bg-surface border-t border-line px-5 py-3 flex flex-wrap gap-3 items-center z-10">
      <div className="grow min-w-0 flex flex-col gap-1" role="status">
        {r.busy || r.events.length ? <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} /> : <span className="small text-ink-muted">{message}</span>}
        {(r.error || error) && <span className="small" role="alert">{r.error ?? error}</span>}
      </div>
      {r.busy ? (
        <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button>
      ) : approve ? (
        <button type="button" className="mn-btn mn-btn--primary" disabled={pending} onClick={() => start(async () => { const res = await approveStage(projectId, stageNumber); setError(res.error); if (!res.error) router.push(`/p/${projectId}`); router.refresh(); })}>{approve}</button>
      ) : write ? (
        <button type="button" className="mn-btn mn-btn--primary" onClick={() => r.run({ kind: "preprod", action: { kind: "write" } })}>
          {write.label}<span className="mn-btn__cost">{write.cost}</span>
        </button>
      ) : null}
    </footer>
  );
}

export function PreprodTryAgain({ projectId, n, failed, cost, run, c }: { projectId: string; n: number; failed: boolean; cost: string; run: RunCopy; c: { failed: string; missing: string; tryAgain: string; write: string } }) {
  const r = useCreativeRun(projectId, run);
  return (
    <div className="flex flex-col gap-3 items-start">
      <p className="body text-ink-muted m-0">{failed ? c.failed : c.missing}</p>
      <div className="flex flex-wrap items-center gap-3">
        {r.busy ? <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button> : (
          <button type="button" className="mn-btn mn-btn--primary" onClick={() => r.run({ kind: "preprod", action: { kind: "redo", n } })}>{failed ? c.tryAgain : c.write}<span className="mn-btn__cost">{cost}</span></button>
        )}
        <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />
      </div>
      {r.error && <p className="small m-0 px-3 py-2 rounded-md bg-tint-2" role="alert">{r.error}</p>}
    </div>
  );
}

export function PreprodAssistant({ projectId, n, copy, cost, mic, run, rewriteLabel, box }: { box?: StepBox; projectId: string; n: number; copy: { label: string; placeholder: string; apply: string; working: string }; cost: string; mic: { start: string; stop: string; working: string; blocked: string }; run: RunCopy; rewriteLabel: string }) {
  const r = useCreativeRun(projectId, run);
  return (
    <div className="flex flex-col gap-2">
      <ChangeBox projectId={projectId} copy={copy} cost={cost} mic={mic} disabled={r.busy} tips={box?.tips} attach={box?.attach} onApply={(text, files) => r.run({ kind: "preprod", action: { kind: "revise", n, instruction: text, files } })} />
      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm justify-between w-full" disabled={r.busy} onClick={() => r.run({ kind: "preprod", action: { kind: "redo", n } })}>
        <span>{rewriteLabel}</span><span className="mn-btn__cost">{cost}</span>
      </button>
      <div className="flex items-center gap-3">
        <RunLine events={r.events} busy={r.busy} c={run} startedAt={r.startedAt} />
        {r.busy && <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={r.stop}>{run.steps.stop}</button>}
      </div>
    </div>
  );
}
