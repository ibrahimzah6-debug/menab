"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMemory, removeMemory, setMemoryOn } from "./actions";

type C = { on: string; off: string; turnOn: string; turnOff: string; add: string; addPlaceholder: string; empty: string; remove: string; fromAi: string; fromPerson: string; adminOnly: string };

// What Menab remembers about this workspace: read it, add to it, remove anything, or turn it off.
export function MemoryPanel({ on, items, canEdit, isAdmin, c }: { on: boolean; items: { id: string; content: string; source: string }[]; canEdit: boolean; isAdmin: boolean; c: C }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      setNote(r.error);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className={`mn-chip ${on ? "mn-chip--ready" : "mn-chip--waiting"}`}>{on ? c.on : c.off}</span>
        <span className="grow" />
        {isAdmin ? (
          <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" disabled={pending} onClick={() => run(() => setMemoryOn(!on))}>
            {on ? c.turnOff : c.turnOn}
          </button>
        ) : (
          <span className="text-[12px] text-ink-faint">{c.adminOnly}</span>
        )}
      </div>
      {canEdit && (
        <form
          className="flex gap-2"
          action={(f) => {
            const v = String(f.get("content") ?? "");
            run(() => addMemory(v));
          }}
        >
          <input name="content" maxLength={300} dir="auto" placeholder={c.addPlaceholder} aria-label={c.add} className="mn-input grow" />
          <button className="mn-btn mn-btn--primary" disabled={pending}>{c.add}</button>
        </form>
      )}
      {items.length === 0 ? (
        <p className="small text-ink-muted m-0">{c.empty}</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col">
          {items.map((m, i) => (
            <li key={m.id} className={`py-2.5 flex items-start gap-3 ${i ? "border-t border-line" : ""}`}>
              <span className="small grow" dir="auto">{m.content}</span>
              <span className="text-[11px] text-ink-faint whitespace-nowrap pt-0.5">{m.source === "ai" ? c.fromAi : c.fromPerson}</span>
              {canEdit && (
                <button type="button" className="text-[12px] underline text-ink-muted hover:text-ink" disabled={pending} onClick={() => run(() => removeMemory(m.id))}>
                  {c.remove}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="small m-0" role="alert">{note}</p>}
    </div>
  );
}
