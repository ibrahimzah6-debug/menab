"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangeBox } from "./editors";
import { RunLine, useCreativeRun, type RunCopy } from "./creative-run";

// Asks Menab to change the open Creative document; the steps show on one line.
export function CreativeAssistant({
  projectId,
  n,
  copy,
  cost,
  mic,
  run,
}: {
  projectId: string;
  n: number;
  copy: { label: string; placeholder: string; apply: string; working: string };
  cost: string;
  mic: { start: string; stop: string; working: string; blocked: string };
  run: RunCopy;
}) {
  const r = useCreativeRun(projectId, run);
  return (
    <div className="flex flex-col gap-2">
      <ChangeBox projectId={projectId} copy={copy} cost={cost} mic={mic} onApply={(text) => r.run({ kind: "revise", n, instruction: text })} />
      <div className="flex items-center gap-3">
        <RunLine events={r.events} busy={r.busy} c={run} />
        {r.busy && <button type="button" className="mn-btn mn-btn--ghost mn-btn--sm" onClick={r.stop}>{run.steps.stop}</button>}
      </div>
    </div>
  );
}

// The footer action that starts the Creative stage: writing the three directions.
export function CreativeStart({ projectId, label, cost, message, run }: { projectId: string; label: string; cost: string; message: string; run: RunCopy }) {
  const r = useCreativeRun(projectId, run);
  return (
    <footer className="shrink-0 sticky bottom-0 bg-surface border-t border-line px-5 py-3 flex flex-wrap gap-3 items-center z-10">
      <div className="grow min-w-0 flex flex-col gap-1">
        {r.busy || r.events.length ? <RunLine events={r.events} busy={r.busy} c={run} /> : <span className="small text-ink-muted">{r.error ?? message}</span>}
        {r.error && (r.busy || r.events.length > 0) && <span className="small" role="alert">{r.error}</span>}
      </div>
      {r.busy ? (
        <button type="button" className="mn-btn mn-btn--secondary" onClick={r.stop}>{run.steps.stop}</button>
      ) : (
        <button type="button" className="mn-btn mn-btn--primary" onClick={() => r.run({ kind: "directions" })}>
          {label}
          <span className="mn-btn__cost">{cost}</span>
        </button>
      )}
    </footer>
  );
}

// While Menab writes in the background, the page checks every few seconds for new pieces.
export function AutoRefresh({ active, every = 4000 }: { active: boolean; every?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), every);
    return () => clearInterval(id);
  }, [active, every, router]);
  return null;
}
