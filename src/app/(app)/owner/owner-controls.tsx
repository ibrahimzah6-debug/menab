"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addRule, prepareAllLanguages, runAnalysisNow, setItemStatus, setRule } from "./actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | undefined>();
  const run = (fn: () => Promise<{ error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      setNote(r.error ?? ok);
      router.refresh();
    });
  return { pending, note, run };
}

export function RunAnalysis({ label, busy }: { label: string; busy: string }) {
  const { pending, note, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="mn-btn mn-btn--primary" disabled={pending} onClick={() => run(runAnalysisNow)}>
        {pending ? busy : label}
      </button>
      {pending && <span className="mn-pulse" aria-hidden="true" />}
      {note && <span className="small" role="alert">{note}</span>}
    </div>
  );
}

export function ItemActions({ id, status, c }: { id: string; status: string; c: { accept: string; done: string; dismiss: string; reopen: string } }) {
  const { pending, note, run } = useRun();
  const btn = "mn-btn mn-btn--secondary mn-btn--sm";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "open" && (
        <>
          <button type="button" className={btn} disabled={pending} onClick={() => run(() => setItemStatus(id, "accepted"))}>{c.accept}</button>
          <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => run(() => setItemStatus(id, "dismissed"))}>{c.dismiss}</button>
        </>
      )}
      {status === "accepted" && <button type="button" className={btn} disabled={pending} onClick={() => run(() => setItemStatus(id, "done"))}>{c.done}</button>}
      {status !== "open" && <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => run(() => setItemStatus(id, "open"))}>{c.reopen}</button>}
      {note && <span className="text-[12px]" role="alert">{note}</span>}
    </div>
  );
}

// Everything accepted, as one task to paste into Claude Code on the menab repository.
export function CopyForClaude({ items, label, copied }: { items: { title: string; detail: string | null; evidence: string | null; kind: string }[]; label: string; copied: string }) {
  const [done, setDone] = useState(false);
  if (!items.length) return null;
  const text = [
    "Work for Menab (repository ibrahimzah6-debug/menab). Read CLAUDE.md and the docs first, then build these, one at a time, and open one pull request:",
    "",
    ...items.map((i, n) => `${n + 1}. [${i.kind}] ${i.title}\n   What: ${i.detail ?? ""}\n   Why: ${i.evidence ?? ""}`),
  ].join("\n");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="mn-btn mn-btn--secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setDone(true);
          } catch {
            setDone(false);
          }
        }}
      >
        {label}
      </button>
      {done && <span className="small">{copied}</span>}
    </div>
  );
}

export function RuleForm({ c }: { c: { add: string; placeholder: string } }) {
  const { pending, note, run } = useRun();
  return (
    <form className="flex gap-2" action={(f) => run(() => addRule(String(f.get("text") ?? "")))}>
      <input name="text" dir="auto" maxLength={500} placeholder={c.placeholder} aria-label={c.add} className="mn-input grow" />
      <button className="mn-btn mn-btn--primary" disabled={pending}>{c.add}</button>
      {note && <span className="small" role="alert">{note}</span>}
    </form>
  );
}

export function RuleActions({ id, active, c }: { id: string; active: boolean; c: { turnOn: string; turnOff: string; remove: string } }) {
  const { pending, run } = useRun();
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" disabled={pending} onClick={() => run(() => setRule(id, !active))}>{active ? c.turnOff : c.turnOn}</button>
      <button type="button" className="text-[12px] underline text-ink-muted hover:text-ink" disabled={pending} onClick={() => run(() => setRule(id, null))}>{c.remove}</button>
    </div>
  );
}

export function PrepareLanguages({ label, busy }: { label: string; busy: string }) {
  const { pending, note, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="mn-btn mn-btn--secondary mn-btn--sm" disabled={pending} onClick={() => run(prepareAllLanguages)}>{pending ? busy : label}</button>
      {note && <span className="small" role="alert">{note}</span>}
    </div>
  );
}
