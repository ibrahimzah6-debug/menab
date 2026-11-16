"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEPARTMENTS } from "@/lib/crew";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { addCrew, deleteCrew, revealCrewId, setCrewId, updateCrew } from "./actions";

// The company's crew: department, role, phone, GAMR registration and the ID number (masked).
type Crew = { id: string; name: string; role: string | null; department: string | null; phone: string | null; gamr_status: string; gamr_number: string | null; id_last4: string | null };
type C = Dictionary["team"]["crew"];

export function CrewSection({ crew, c, lang, canEdit, canReveal }: { crew: Crew[]; c: C; lang: "en" | "ar"; canEdit: boolean; canReveal: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const [shown, setShown] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ name: "", role: "", department: "", phone: "" });
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setNote(r.error);
      if (!r.error) after?.();
      router.refresh();
    });
  const reveal = (id: string) =>
    start(async () => {
      const r = await revealCrewId(id);
      if (r.error) return setNote(r.error);
      setShown((s) => ({ ...s, [id]: r.value ?? "" }));
      // Hidden again after 20 seconds.
      setTimeout(() => setShown((s) => { const n = { ...s }; delete n[id]; return n; }), 20_000);
    });
  const gamr = (s: string) => c.gamr[s as keyof C["gamr"]] ?? s;
  const chip = (s: string) => (s === "registered" ? "mn-chip--approved" : s === "not_registered" ? "mn-chip--failed" : "mn-chip--waiting");

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="h3 m-0">{c.title}</h2>
        <p className="small text-ink-muted m-0 mt-1">{c.intro}</p>
      </div>
      {canEdit && (
        <form
          className="bg-surface border border-line rounded-lg p-4 grid gap-3 items-end"
          style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr auto" }}
          onSubmit={(e) => { e.preventDefault(); run(() => addCrew(draft), () => setDraft({ name: "", role: "", department: "", phone: "" })); }}
        >
          <label className="flex flex-col gap-1"><span className="mn-label">{c.name}</span><input className="mn-input h-9" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
          <label className="flex flex-col gap-1"><span className="mn-label">{c.role}</span><input className="mn-input h-9" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder={c.rolePlaceholder} /></label>
          <label className="flex flex-col gap-1">
            <span className="mn-label">{c.department}</span>
            <select className="mn-select h-9" value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })}>
              <option value="">–</option>
              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d[lang]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1"><span className="mn-label">{c.phone}</span><input className="mn-input h-9" dir="ltr" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
          <button type="submit" className="mn-btn mn-btn--secondary" disabled={pending}>{c.add}</button>
        </form>
      )}
      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full border-collapse text-[14px]" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              {[c.name, c.department, c.role, c.phone, c.gamrStatus, c.gamrNumber, c.idNumber, ""].map((h, i) => <th key={i} scope="col" className="mn-label text-start px-4 py-3 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {crew.length === 0 && <tr><td colSpan={8} className="px-4 py-4 small text-ink-muted">{c.empty}</td></tr>}
            {crew.map((m) => (
              <tr key={m.id} className="border-t border-line align-middle">
                <td className="px-4 py-2" dir="auto">{m.name}</td>
                <td className="px-4 py-2">
                  <select className="mn-select h-8" aria-label={c.department} value={m.department ?? ""} disabled={!canEdit || pending} onChange={(e) => run(() => updateCrew(m.id, { department: e.target.value }))}>
                    <option value="">–</option>
                    {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d[lang]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 small" dir="auto">{m.role ?? "–"}</td>
                <td className="px-4 py-2 small" dir="ltr">{m.phone ?? "–"}</td>
                <td className="px-4 py-2">
                  {canEdit ? (
                    <select className="mn-select h-8" aria-label={c.gamrStatus} value={m.gamr_status} disabled={pending} onChange={(e) => run(() => updateCrew(m.id, { gamr_status: e.target.value }))}>
                      {(["registered", "pending", "not_registered", "unknown"] as const).map((s) => <option key={s} value={s}>{gamr(s)}</option>)}
                    </select>
                  ) : (
                    <span className={`mn-chip ${chip(m.gamr_status)}`}>{gamr(m.gamr_status)}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <input className="mn-input h-8 w-[130px]" dir="ltr" aria-label={c.gamrNumber} defaultValue={m.gamr_number ?? ""} disabled={!canEdit || pending} onBlur={(e) => e.target.value !== (m.gamr_number ?? "") && run(() => updateCrew(m.id, { gamr_number: e.target.value }))} />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {shown[m.id] !== undefined ? (
                    <span className="data" dir="ltr">{shown[m.id] || "–"}</span>
                  ) : m.id_last4 ? (
                    <span className="data" dir="ltr">•••••• {m.id_last4}</span>
                  ) : (
                    <span className="text-ink-faint small">–</span>
                  )}
                  {m.id_last4 && canReveal && shown[m.id] === undefined && <button type="button" className="text-[12px] underline ms-2" disabled={pending} onClick={() => reveal(m.id)}>{c.show}</button>}
                  {canEdit && (
                    <button
                      type="button"
                      className="text-[12px] underline ms-2"
                      disabled={pending}
                      onClick={() => {
                        const v = window.prompt(c.idPrompt);
                        if (v !== null) run(() => setCrewId(m.id, v));
                      }}
                    >
                      {m.id_last4 ? c.change : c.addId}
                    </button>
                  )}
                </td>
                <td className="px-4 py-2 text-end">
                  {canEdit && <button type="button" className="text-[12px] underline text-ink-muted" disabled={pending} onClick={() => window.confirm(c.removeConfirm.replace("{name}", m.name)) && run(() => deleteCrew(m.id))}>{c.remove}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-ink-faint m-0">{c.idNote}</p>
      {note && <p className="small m-0" role="alert">{note}</p>}
    </section>
  );
}
