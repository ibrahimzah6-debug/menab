"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type RunCopy = {
  thinking: string;
  outputs: Record<number, string>;
  steps: {
    call: string;
    retry: string;
    switch: string;
    skip: string;
    writing: string;
    writingDocs: string;
    saved: string;
    stopped: string;
    lost: string;
    stop: string;
    seconds: string;
    drawing?: string;
    drawn?: string;
    drawFailed?: string;
    drawBackup?: string;
  };
};
type Ev = { t: string; at?: number; [k: string]: unknown };
type Action =
  | { kind: "directions" }
  | { kind: "build" }
  | { kind: "revise"; n: number; instruction: string }
  | { kind: "redo"; n: number }
  | { kind: "docs"; instruction?: string }
  | { kind: "look"; action: { kind: "write" } | { kind: "redo"; n: number } | { kind: "revise"; n: number; instruction: string } }
  | { kind: "frames"; frames: number[]; style: "sketch" | "photo"; model: string; aspect: string };

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
    case "writingDocs":
      return c.steps.writingDocs;
    case "drawing":
      return fillIn(c.steps.drawing ?? "", { n: Number(e.n), total: Number(e.total), model: String(e.model ?? "") });
    case "drawn":
      return fillIn(c.steps.drawn ?? "", { n: Number(e.n) });
    case "drawFailed":
      return fillIn(c.steps.drawFailed ?? "", { n: Number(e.n), reason: String(e.reason ?? "") });
    case "drawBackup":
      return fillIn(c.steps.drawBackup ?? "", { n: Number(e.n), from: String(e.from ?? ""), to: String(e.to ?? "") });
    case "saved":
      return fillIn(c.steps.saved, { name: name(e.n) });
    default:
      return null;
  }
}

// Runs a piece of AI work through a streaming endpoint (/p/[id]/creative for the Creative
// stage, /p/[id]/documents for the stage 1 documents) and keeps its steps with their times.
// Each finished piece refreshes the page, so the person reads it while the rest is written.
export function useCreativeRun(projectId: string, c: RunCopy) {
  const router = useRouter();
  const [events, setEvents] = useState<Ev[]>([]);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>();
  const ctrl = useRef<AbortController | null>(null);

  const run = async (action: Action): Promise<{ error?: string }> => {
    const controller = new AbortController();
    ctrl.current = controller;
    const start = Date.now();
    setBusy(true);
    setStartedAt(start);
    setError(undefined);
    setEvents([]);
    let failure: string | undefined;
    let finished = false;
    try {
      const endpoint = action.kind === "docs" ? "documents" : action.kind === "look" ? "look" : action.kind === "frames" ? "frames" : "creative";
      const payload = action.kind === "docs" ? { instruction: action.instruction } : action.kind === "look" ? action.action : action;
      const res = await fetch(`/p/${projectId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
            setEvents((x) => [...x, { ...e, at: Date.now() - start }]);
            if (e.t === "saved" || e.t === "drawn") router.refresh();
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

  return { run, busy, events, error, startedAt, stop: () => ctrl.current?.abort() };
}

// Seconds since a moment, ticking every second while active.
export function useSeconds(since: number | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return since ? Math.max(0, Math.round((now - since) / 1000)) : 0;
}

// One line whose words change as Menab works, with the seconds so far; press it to see every
// step and when it happened. It stays after the work is done, with the total time.
export function RunLine({ events, busy, c, startedAt }: { events: Ev[]; busy: boolean; c: RunCopy; startedAt?: number | null }) {
  const [open, setOpen] = useState(false);
  const secs = useSeconds(startedAt ?? null, busy);
  const lines = events.map((e) => ({ text: lineOf(e, c), at: e.at })).filter((x): x is { text: string; at: number | undefined } => Boolean(x.text));
  if (!busy && !lines.length) return null;
  const total = busy ? secs : Math.round((events[events.length - 1]?.at ?? 0) / 1000);
  return (
    <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
      <button type="button" className="self-start flex items-center gap-2 small text-start" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {busy ? <span className="mn-pulse shrink-0" aria-hidden="true" /> : <span aria-hidden="true" className="text-ink-muted">✓</span>}
        <span dir="auto" className={busy ? "text-ink" : "text-ink-muted"}>{lines[lines.length - 1]?.text ?? c.thinking}</span>
        <span className="data text-[12px] text-ink-faint">· {fillIn(c.steps.seconds, { n: total })}</span>
      </button>
      {open && (
        <ol className="m-0 ms-1.5 ps-4 border-s border-line list-none flex flex-col gap-1">
          {lines.map((x, i) => (
            <li key={i} className="text-[12px] text-ink-muted flex gap-2" dir="auto">
              <span className="data text-ink-faint shrink-0">{fillIn(c.steps.seconds, { n: Math.round((x.at ?? 0) / 1000) })}</span>
              <span>{x.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
