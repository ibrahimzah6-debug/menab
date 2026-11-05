"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type RunCopy = {
  thinking: string;
  outputs: Record<number, string>;
  steps: { call: string; retry: string; switch: string; skip: string; writing: string; saved: string; stopped: string; lost: string; stop: string };
};
type Ev = { t: string; [k: string]: unknown };
type Action = { kind: "directions" } | { kind: "build" } | { kind: "revise"; n: number; instruction: string };

const fillIn = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

function lineOf(e: Ev, c: RunCopy) {
  const name = (n: unknown) => c.outputs[Number(n)] ?? "";
  switch (e.t) {
    case "call":
      return fillIn(c.steps.call, { model: String(e.model) });
    case "retry":
      return fillIn(c.steps.retry, { model: String(e.model) });
    case "switch":
      return fillIn(c.steps.switch, { from: String(e.from), to: String(e.to) });
    case "skip":
      return fillIn(c.steps.skip, { from: String(e.from), to: String(e.to) });
    case "writing":
      return fillIn(c.steps.writing, { name: name(e.n) });
    case "saved":
      return fillIn(c.steps.saved, { name: name(e.n) });
    default:
      return null;
  }
}

// Runs a piece of Creative work through /p/[id]/creative and keeps its steps. Each finished
// piece refreshes the page, so the person reads it while the rest is written.
export function useCreativeRun(projectId: string, c: RunCopy) {
  const router = useRouter();
  const [events, setEvents] = useState<Ev[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const ctrl = useRef<AbortController | null>(null);

  const run = async (action: Action): Promise<{ error?: string }> => {
    const controller = new AbortController();
    ctrl.current = controller;
    setBusy(true);
    setError(undefined);
    setEvents([]);
    let failure: string | undefined;
    let finished = false;
    try {
      const res = await fetch(`/p/${projectId}/creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(c.steps.lost);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const e = JSON.parse(l) as Ev;
          if (e.t === "done") finished = true;
          else if (e.t === "error") {
            finished = true;
            failure = String(e.message);
          } else {
            setEvents((x) => [...x, e]);
            if (e.t === "saved") router.refresh();
          }
        }
      }
      if (!finished) failure = c.steps.lost;
    } catch (e) {
      failure = controller.signal.aborted ? c.steps.stopped : e instanceof Error && e.message ? e.message : c.steps.lost;
    } finally {
      ctrl.current = null;
      setBusy(false);
      router.refresh();
    }
    setError(failure);
    return { error: failure };
  };

  return { run, busy, events, error, stop: () => ctrl.current?.abort() };
}

// One line whose words change as Menab works; press it to see every step.
export function RunLine({ events, busy, c }: { events: Ev[]; busy: boolean; c: RunCopy }) {
  const [open, setOpen] = useState(false);
  const lines = events.map((e) => lineOf(e, c)).filter((x): x is string => Boolean(x));
  useEffect(() => {
    if (!busy) setOpen(false);
  }, [busy]);
  if (!busy && !lines.length) return null;
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <button type="button" className="self-start flex items-center gap-2 small text-start" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {busy ? <span className="mn-pulse shrink-0" aria-hidden="true" /> : <span aria-hidden="true" className="text-ink-muted">✓</span>}
        <span dir="auto" className={busy ? "text-ink" : "text-ink-muted"}>{lines[lines.length - 1] ?? c.thinking}</span>
      </button>
      {open && (
        <ol className="m-0 ms-1.5 ps-4 border-s border-line list-none flex flex-col gap-1">
          {lines.map((x, i) => (
            <li key={i} className="text-[12px] text-ink-muted" dir="auto">{x}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
